import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface TriageRequest {
  ticket_id: string;
  titolo: string;
  descrizione: string;
  property_name?: string;
}

interface AiAnalysis {
  priorita: string;
  categoria: string;
  suggerimento: string;
  confidence: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: TriageRequest = await req.json();
    const { ticket_id, titolo, descrizione, property_name } = payload;

    if (!ticket_id || !titolo) {
      return new Response(
        JSON.stringify({ error: "ticket_id e titolo sono obbligatori" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const analysis = await analyzeWithClaude(titolo, descrizione, property_name || "");

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
      }).catch(err => console.error("Notification insert failed:", err));
    }

    return new Response(
      JSON.stringify({ ticket_id, analysis }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI triage error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function analyzeWithClaude(
  titolo: string,
  descrizione: string,
  propertyName: string
): Promise<AiAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return fallbackAnalysis(titolo, descrizione);
  }

  const today = new Date().toISOString().split("T")[0];
  const month = new Date().getMonth() + 1;
  const season =
    month >= 11 || month <= 3
      ? "inverno"
      : month <= 5
      ? "primavera"
      : month <= 8
      ? "estate"
      : "autunno";

  const prompt = `Sei un assistente per la gestione immobiliare in Italia. Analizza questo ticket di manutenzione e rispondi SOLO in JSON valido.

Contesto:
- Proprieta: ${propertyName || "non specificata"}
- Stagione: ${season}
- Data: ${today}

Titolo ticket: "${titolo}"
Descrizione: "${descrizione || "nessuna descrizione"}"

Rispondi con questo JSON esatto:
{
  "priorita": "alta|media|bassa",
  "categoria": "una tra: impianto_termico, impianto_elettrico, idraulica, serrature_accesso, pulizia, rumore, infiltrazioni, elettrodomestici, arredamento, esterno_giardino, documenti, condominio, pagamenti, altro",
  "suggerimento": "breve suggerimento operativo per il proprietario (max 150 caratteri)",
  "confidence": 0.0-1.0
}

Criteri priorita:
- ALTA: emergenze (no riscaldamento in inverno, perdita acqua, no corrente, serratura rotta, allagamento)
- MEDIA: disagi significativi ma non urgenti (elettrodomestico guasto, rumore, pulizia insufficiente)
- BASSA: richieste informative, problemi estetici o minori`;

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
      return fallbackAnalysis(titolo, descrizione);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackAnalysis(titolo, descrizione);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      priorita: parsed.priorita || "media",
      categoria: parsed.categoria || "altro",
      suggerimento: parsed.suggerimento || "",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    };
  } catch (err) {
    console.error("Claude analysis error:", err);
    return fallbackAnalysis(titolo, descrizione);
  }
}

function fallbackAnalysis(titolo: string, descrizione: string): AiAnalysis {
  const text = `${titolo} ${descrizione}`.toLowerCase();
  const urgentKeywords = [
    "riscaldamento", "caldaia", "acqua", "perdita", "allagat",
    "corrente", "luce", "gas", "serratura", "chiave", "emergenz",
  ];
  const isUrgent = urgentKeywords.some((k) => text.includes(k));

  let categoria = "altro";
  if (text.match(/riscald|caldai|termosifon|freddo/)) categoria = "impianto_termico";
  else if (text.match(/luce|corrent|elettric|presa|interruttore/)) categoria = "impianto_elettrico";
  else if (text.match(/acqua|perdita|rubinett|scarico|tubo|bagno/)) categoria = "idraulica";
  else if (text.match(/porta|serratur|chiave|chiuso/)) categoria = "serrature_accesso";
  else if (text.match(/sporco|pulizi|igien/)) categoria = "pulizia";
  else if (text.match(/infiltr|umid|muffa/)) categoria = "infiltrazioni";
  else if (text.match(/frigo|lavatrice|forno|lavastoviglie/)) categoria = "elettrodomestici";
  else if (text.match(/condomin|amminist|assemblea/)) categoria = "condominio";
  else if (text.match(/pagament|affitto|bolletta|rata/)) categoria = "pagamenti";

  return {
    priorita: isUrgent ? "alta" : "media",
    categoria,
    suggerimento: isUrgent
      ? "Problema urgente. Contattare tecnico specializzato."
      : "Verificare la situazione e programmare intervento.",
    confidence: 0.4,
  };
}
