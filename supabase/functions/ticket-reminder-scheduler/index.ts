import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderResult {
  sent: number;
  skipped: number;
  errors: string[];
}

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  message: string
): Promise<boolean> {
  // Normalizza numero: rimuovi +, spazi, trattini
  const normalized = toPhone.replace(/[\s\-\+]/g, "");

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
          to: normalized,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`WhatsApp send error to ${normalized}:`, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`WhatsApp fetch error to ${normalized}:`, err);
    return false;
  }
}

async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<boolean> {
  const normalized = toPhone.replace(/[\s\-\+]/g, "");

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
          to: normalized,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [
              {
                type: "body",
                parameters: bodyParams.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`WhatsApp template error to ${normalized}:`, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`WhatsApp template fetch error to ${normalized}:`, err);
    return false;
  }
}

async function processTicketReminders(
  supabase: ReturnType<typeof createClient>
): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, skipped: 0, errors: [] };

  // Calcola date oggi e domani
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Leggi config WhatsApp
  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("enabled", true)
    .limit(1)
    .single();

  if (!config?.phone_number_id) {
    result.errors.push("WhatsApp config non trovata o disabilitata");
    return result;
  }

  const accessToken = config.access_token || WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    result.errors.push("WHATSAPP_ACCESS_TOKEN mancante");
    return result;
  }

  // Query ticket: scadono oggi (non ancora inviato reminder oggi) o domani (non ancora inviato reminder domani)
  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select(`
      id,
      titolo,
      descrizione,
      data_scadenza,
      assigned_to,
      reminder_day_before_sent,
      reminder_day_of_sent,
      properties_real (nome),
      properties_mobile (veicolo)
    `)
    .neq("stato", "risolto")
    .in("data_scadenza", [todayStr, tomorrowStr])
    .not("assigned_to", "is", null);

  if (ticketsError) {
    result.errors.push(`Errore query tickets: ${ticketsError.message}`);
    return result;
  }

  if (!tickets || tickets.length === 0) {
    console.log("Nessun ticket da ricordare oggi");
    return result;
  }

  for (const ticket of tickets) {
    const assignedIds: string[] = ticket.assigned_to || [];
    if (assignedIds.length === 0) {
      result.skipped++;
      continue;
    }

    const isToday = ticket.data_scadenza === todayStr;
    const isTomorrow = ticket.data_scadenza === tomorrowStr;

    // Salta se reminder già inviato
    if (isToday && ticket.reminder_day_of_sent) {
      result.skipped++;
      continue;
    }
    if (isTomorrow && ticket.reminder_day_before_sent) {
      result.skipped++;
      continue;
    }

    // Leggi telefoni degli assegnati
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, phone")
      .in("id", assignedIds);

    if (profilesError || !profiles) {
      result.errors.push(`Errore profiles per ticket ${ticket.id}: ${profilesError?.message}`);
      continue;
    }

    // Nome proprietà
    const propName =
      (ticket.properties_real as any)?.nome ||
      (ticket.properties_mobile as any)?.veicolo ||
      "";

    let ticketSentCount = 0;

    for (const profile of profiles) {
      if (!profile.phone) {
        console.log(`Nessun telefono per ${profile.first_name} (${profile.id}), skip`);
        result.skipped++;
        continue;
      }

      // Costruisci parametri template promemoria_attivita
      // {{1}} nome operatore, {{2}} titolo ticket, {{3}} data, {{4}} proprietà
      const dataLabel = isToday
        ? todayStr
        : tomorrowStr;

      const sent = await sendWhatsAppTemplate(
        config.phone_number_id,
        accessToken,
        profile.phone,
        "appointment_reminder",
        "en_US",
        [
          profile.first_name || "Operatore",  // {{1}} nome
          ticket.titolo,                        // {{2}} titolo ticket
          dataLabel,                            // {{3}} data
          propName || "—",                      // {{4}} proprietà
        ]
      );

      if (sent) {
        ticketSentCount++;
        result.sent++;
      } else {
        result.errors.push(`Invio fallito a ${profile.phone} per ticket ${ticket.id}`);
      }
    }

    // Aggiorna flag solo se almeno un messaggio inviato con successo
    if (ticketSentCount > 0) {
      const updateField = isToday
        ? { reminder_day_of_sent: true }
        : { reminder_day_before_sent: true };

      const { error: updateError } = await supabase
        .from("tickets")
        .update(updateField)
        .eq("id", ticket.id);

      if (updateError) {
        result.errors.push(`Errore aggiornamento flag ticket ${ticket.id}: ${updateError.message}`);
      }
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const result = await processTicketReminders(supabase);

    console.log("Ticket reminders result:", JSON.stringify(result));

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: result.sent,
        skipped: result.skipped,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ticket-reminder-scheduler error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
