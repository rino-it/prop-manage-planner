import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

interface ProcessRequest {
  from_number: string;
  message_body: string;
  wa_message_id: string;
  contact_name: string;
  phone_number_id: string;
}

interface TenantContext {
  guest_name: string;
  property_name: string | null;
  property_address: string | null;
  booking_id: string | null;
  booking_start: string | null;
  booking_end: string | null;
  ticket_history: { titolo: string; stato: string; created_at: string }[];
}

interface AiAnalysis {
  priorita: string;
  categoria: string;
  suggerimento: string;
  confidence: number;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: ProcessRequest = await req.json();
    const { from_number, message_body, wa_message_id, contact_name, phone_number_id } = payload;

    // 1. Identifica inquilino dal numero di telefono
    const normalizedPhone = normalizePhone(from_number);
    const context = await findTenantContext(supabase, normalizedPhone, contact_name);

    // 2. Analisi AI con Claude (Haiku per costi minimi)
    const aiAnalysis = await analyzeWithClaude(message_body, context);

    // 3. Crea ticket nel DB
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        titolo: truncate(message_body, 100),
        descrizione: buildTicketDescription(message_body, context, contact_name),
        stato: "aperto",
        priorita: mapPriority(aiAnalysis.priorita),
        source: "whatsapp",
        whatsapp_message_id: wa_message_id,
        whatsapp_from: from_number,
        ai_categoria: aiAnalysis.categoria,
        ai_priorita: aiAnalysis.priorita,
        ai_suggerimento: aiAnalysis.suggerimento,
        ai_confidence: aiAnalysis.confidence,
        booking_id: context.booking_id,
      })
      .select("id")
      .single();

    if (ticketError) {
      throw new Error(`Errore creazione ticket: ${ticketError.message}`);
    }

    // 4. Aggiorna log messaggio come processato
    await supabase
      .from("whatsapp_messages")
      .update({ processed: true, ticket_id: ticket.id })
      .eq("wa_message_id", wa_message_id);

    // 5. Recupera configurazione WhatsApp per inviare notifica al proprietario
    const config = await getWhatsAppConfig(supabase);

    if (config) {
      await sendOwnerNotification(
        config,
        phone_number_id,
        context,
        message_body,
        aiAnalysis,
        ticket.id
      );
    }

    // 6. Invia conferma ricezione all'inquilino
    if (config) {
      await sendTenantAck(config, phone_number_id, from_number, context.guest_name);
    }

    return new Response(
      JSON.stringify({ ticket_id: ticket.id, analysis: aiAnalysis }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process ticket error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// --- Funzioni di supporto ---

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("39")) cleaned = "+" + cleaned;
  if (!cleaned.startsWith("+")) cleaned = "+39" + cleaned;
  return cleaned;
}

async function findTenantContext(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  contactName: string
): Promise<TenantContext> {
  const phoneVariants = [
    phone,
    phone.replace("+39", ""),
    phone.replace("+", ""),
    phone.replace("+39", "0"),
  ];

  // Cerca nelle prenotazioni attive per telefono
  const today = new Date().toISOString().split("T")[0];
  let booking = null;

  for (const variant of phoneVariants) {
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, nome_ospite, data_inizio, data_fine,
        properties_real (nome, indirizzo)
      `)
      .or(`telefono_ospite.eq.${variant},whatsapp_phone.eq.${variant}`)
      .lte("data_inizio", today)
      .gte("data_fine", today)
      .limit(1)
      .single();

    if (data) {
      booking = data;
      break;
    }
  }

  // Se non troviamo booking attivo, cerca l'ultimo booking per questo numero
  if (!booking) {
    for (const variant of phoneVariants) {
      const { data } = await supabase
        .from("bookings")
        .select(`
          id, nome_ospite, data_inizio, data_fine,
          properties_real (nome, indirizzo)
        `)
        .or(`telefono_ospite.eq.${variant},whatsapp_phone.eq.${variant}`)
        .order("data_fine", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        booking = data;
        break;
      }
    }
  }

  // Storico ticket per questo inquilino (se ha un booking)
  let ticketHistory: { titolo: string; stato: string; created_at: string }[] = [];
  if (booking) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("titolo, stato, created_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(5);

    ticketHistory = tickets || [];
  }

  const property = (booking as any)?.properties_real;

  return {
    guest_name: booking?.nome_ospite || contactName || "Sconosciuto",
    property_name: property?.nome || null,
    property_address: property?.indirizzo || null,
    booking_id: booking?.id || null,
    booking_start: booking?.data_inizio || null,
    booking_end: booking?.data_fine || null,
    ticket_history: ticketHistory,
  };
}

async function analyzeWithClaude(
  message: string,
  context: TenantContext
): Promise<AiAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return fallbackAnalysis(message);
  }

  const today = new Date().toISOString().split("T")[0];
  const month = new Date().getMonth() + 1;
  const season = month >= 11 || month <= 3 ? "inverno" : month <= 5 ? "primavera" : month <= 8 ? "estate" : "autunno";

  const prompt = `Sei un assistente per la gestione immobiliare in Italia. Analizza questo messaggio di un inquilino e rispondi SOLO in JSON valido.

Contesto:
- Inquilino: ${context.guest_name}
- Proprieta: ${context.property_name || "non identificata"}
- Indirizzo: ${context.property_address || "non disponibile"}
- Periodo booking: ${context.booking_start || "?"} - ${context.booking_end || "?"}
- Stagione: ${season}
- Data: ${today}
- Storico ticket: ${context.ticket_history.length} precedenti

Messaggio inquilino: "${message}"

Rispondi con questo JSON esatto:
{
  "priorita": "alta|media|bassa",
  "categoria": "una tra: impianto_termico, impianto_elettrico, idraulica, serrature_accesso, pulizia, rumore, infiltrazioni, elettrodomestici, arredamento, esterno_giardino, documenti, altro",
  "suggerimento": "breve suggerimento operativo per il proprietario (max 150 caratteri)",
  "confidence": 0.0-1.0
}

Criteri priorita:
- ALTA: emergenze (no riscaldamento in inverno, perdita acqua, no corrente, serratura rotta)
- MEDIA: disagi significativi ma non urgenti (elettrodomestico guasto, rumore, pulizia)
- BASSA: richieste informative o problemi minori`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error(`Claude API error: ${response.status}`);
      return fallbackAnalysis(message);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackAnalysis(message);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      priorita: parsed.priorita || "media",
      categoria: parsed.categoria || "altro",
      suggerimento: parsed.suggerimento || "",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    };
  } catch (err) {
    console.error("Claude analysis error:", err);
    return fallbackAnalysis(message);
  }
}

function fallbackAnalysis(message: string): AiAnalysis {
  const lower = message.toLowerCase();
  const urgentKeywords = ["riscaldamento", "caldaia", "acqua", "perdita", "allagat", "corrente", "luce", "gas", "serratura", "chiave", "emergenz"];
  const isUrgent = urgentKeywords.some((k) => lower.includes(k));

  let categoria = "altro";
  if (lower.match(/riscald|caldai|termosifon|freddo/)) categoria = "impianto_termico";
  else if (lower.match(/luce|corrent|elettric|presa|interruttore/)) categoria = "impianto_elettrico";
  else if (lower.match(/acqua|perdita|rubinett|scarico|tubo|bagno/)) categoria = "idraulica";
  else if (lower.match(/porta|serratur|chiave|chiuso/)) categoria = "serrature_accesso";
  else if (lower.match(/sporco|pulizi|igien/)) categoria = "pulizia";

  return {
    priorita: isUrgent ? "alta" : "media",
    categoria,
    suggerimento: isUrgent
      ? "Problema urgente. Contattare tecnico specializzato."
      : "Verificare la situazione e programmare intervento.",
    confidence: 0.4,
  };
}

function mapPriority(aiPriority: string): string {
  const map: Record<string, string> = {
    alta: "alta",
    media: "media",
    bassa: "bassa",
  };
  return map[aiPriority] || "media";
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
}

function buildTicketDescription(
  message: string,
  context: TenantContext,
  contactName: string
): string {
  const lines = [
    `[WhatsApp] Messaggio da: ${context.guest_name}`,
    context.property_name ? `Proprieta: ${context.property_name}` : null,
    context.booking_start ? `Booking: ${context.booking_start} - ${context.booking_end}` : null,
    ``,
    `Messaggio originale:`,
    message,
  ];
  return lines.filter(Boolean).join("\n");
}

async function getWhatsAppConfig(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("enabled", true)
    .limit(1)
    .single();

  return data;
}

async function sendOwnerNotification(
  config: {
    owner_whatsapp: string;
    access_token?: string;
  },
  phoneNumberId: string,
  context: TenantContext,
  message: string,
  analysis: AiAnalysis,
  ticketId: string
) {
  const accessToken = config.access_token || WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !config.owner_whatsapp) return;

  const priorityEmoji: Record<string, string> = {
    alta: "[!] ALTA PRIORITA",
    media: "[i] MEDIA PRIORITA",
    bassa: "[-] BASSA PRIORITA",
  };

  const body = [
    priorityEmoji[analysis.priorita] || "[i] TICKET",
    ``,
    `Inquilino: ${context.guest_name}`,
    context.property_name ? `Proprieta: ${context.property_name}` : "",
    context.booking_start ? `Booking: ${context.booking_start} - ${context.booking_end}` : "",
    ``,
    `Messaggio: "${truncate(message, 200)}"`,
    ``,
    `Analisi AI:`,
    `Categoria: ${analysis.categoria}`,
    `Priorita: ${analysis.priorita}`,
    `Suggerimento: ${analysis.suggerimento}`,
    ``,
    `Storico: ${context.ticket_history.length} ticket precedenti`,
    `Ticket ID: ${ticketId.substring(0, 8)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: config.owner_whatsapp,
          type: "text",
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Failed to send owner notification:", err);
    }
  } catch (err) {
    console.error("Send owner notification error:", err);
  }
}

async function sendTenantAck(
  config: { access_token?: string },
  phoneNumberId: string,
  tenantPhone: string,
  guestName: string
) {
  const accessToken = config.access_token || WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return;

  const name = guestName.split(" ")[0] || "Gentile ospite";

  try {
    await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: tenantPhone,
          type: "text",
          text: {
            body: `Ciao ${name}, abbiamo ricevuto la tua segnalazione. Il proprietario e stato avvisato e ti rispondera al piu presto. Grazie per la pazienza.`,
          },
        }),
      }
    );
  } catch (err) {
    console.error("Send tenant ack error:", err);
  }
}
