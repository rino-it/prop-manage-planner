import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  ticket_id: string;
  titolo: string;
  descrizione: string;
  property_name?: string;
  property_address?: string;
  guest_name?: string;
}

interface AiAnalysis {
  priorita: string;
  categoria: string;
  suggerimento: string;
  confidence: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: AnalyzeRequest = await req.json();
    const { ticket_id, titolo, descrizione, property_name, property_address, guest_name } = payload;

    if (!ticket_id) {
      throw new Error("ticket_id obbligatorio");
    }

    const message = `${titolo}. ${descrizione || ""}`;
    const analysis = await analyzeWithClaude(message, property_name, property_address, guest_name);

    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        ai_categoria: analysis.categoria,
        ai_priorita: analysis.priorita,
        ai_suggerimento: analysis.suggerimento,
        ai_confidence: analysis.confidence,
        priorita: analysis.priorita,
      })
      .eq("id", ticket_id);

    if (updateError) {
      throw new Error(`Errore aggiornamento ticket: ${updateError.message}`);
    }

    // Crea notifica per il proprietario (colonne reali del DB: title, message, type, is_read, link)
    const { data: ticket } = await supabase
      .from("tickets")
      .select("user_id")
      .eq("id", ticket_id)
      .single();

    if (ticket?.user_id) {
      const priorityLabel = analysis.priorita === "alta" ? "ALTA" : analysis.priorita === "media" ? "MEDIA" : "BASSA";
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        type: analysis.priorita === "alta" ? "error" : "warning",
        title: `[${priorityLabel}] ${titolo.substring(0, 60)}`,
        message: `Categoria: ${analysis.categoria.replace(/_/g, " ")} | ${analysis.suggerimento}`,
        link: `/tickets`,
        is_read: false,
        ticket_id: ticket_id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze ticket error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeWithClaude(
  message: string,
  propertyName?: string,
  propertyAddress?: string,
  guestName?: string
): Promise<AiAnalysis> {
  if (!ANTHROPIC_API_KEY) return fallbackAnalysis(message);

  const month = new Date().getMonth() + 1;
  const season = month >= 11 || month <= 3 ? "inverno" : month <= 5 ? "primavera" : month <= 8 ? "estate" : "autunno";

  const prompt = `Sei un assistente per la gestione immobiliare in Italia. Analizza questo ticket e rispondi SOLO in JSON valido.

Contesto:
- Proprieta: ${propertyName || "non specificata"}
- Indirizzo: ${propertyAddress || "non disponibile"}
- Segnalato da: ${guestName || "proprietario"}
- Stagione: ${season}
- Data: ${new Date().toISOString().split("T")[0]}

Ticket: "${message}"

Rispondi con questo JSON esatto:
{
  "priorita": "alta|media|bassa",
  "categoria": "una tra: impianto_termico, impianto_elettrico, idraulica, serrature_accesso, pulizia, rumore, infiltrazioni, elettrodomestici, arredamento, esterno_giardino, documenti, condominio, pagamenti, altro",
  "suggerimento": "breve suggerimento operativo (max 150 caratteri)",
  "confidence": 0.0-1.0
}

Criteri priorita:
- ALTA: emergenze (no riscaldamento in inverno, perdita acqua, no corrente, serratura rotta, allagamento)
- MEDIA: disagi significativi ma non urgenti (elettrodomestico guasto, rumore, pulizia)
- BASSA: richieste informative, problemi minori, documenti`;

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
  else if (lower.match(/condomin|amminist|assemblea/)) categoria = "condominio";
  else if (lower.match(/pagament|affitto|bolletta|rata/)) categoria = "pagamenti";
  else if (lower.match(/infiltra|umid|muffa|tetto/)) categoria = "infiltrazioni";

  return {
    priorita: isUrgent ? "alta" : "media",
    categoria,
    suggerimento: isUrgent ? "Problema urgente. Contattare tecnico specializzato." : "Verificare la situazione e programmare intervento.",
    confidence: 0.4,
  };
}
