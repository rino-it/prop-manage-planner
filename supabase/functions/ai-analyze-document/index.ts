import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface AnalyzeRequest {
  document_url: string;
  booking_id: string;
  document_id?: string;
}

interface DocumentAnalysis {
  tipo_documento: string;
  nome_completo: string;
  codice_fiscale: string;
  data_scadenza: string | null;
  data_nascita: string | null;
  numero_documento: string;
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
    const payload: AnalyzeRequest = await req.json();
    const { document_url, booking_id, document_id } = payload;

    if (!document_url || !booking_id) {
      return new Response(
        JSON.stringify({ error: "document_url e booking_id sono obbligatori" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const imageData = await fetchDocumentImage(supabase, document_url);
    if (!imageData) {
      return new Response(
        JSON.stringify({ error: "Impossibile recuperare il documento" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const analysis = await analyzeDocumentWithClaude(imageData.base64, imageData.mediaType);

    if (analysis.confidence >= 0.6) {
      const updateData: Record<string, unknown> = {};

      if (analysis.tipo_documento) updateData.ai_doc_type = analysis.tipo_documento;
      if (analysis.nome_completo) updateData.ai_extracted_name = analysis.nome_completo;
      if (analysis.codice_fiscale) updateData.ai_extracted_cf = analysis.codice_fiscale;
      if (analysis.data_scadenza) updateData.ai_doc_expiry = analysis.data_scadenza;
      if (analysis.numero_documento) updateData.ai_doc_number = analysis.numero_documento;

      if (Object.keys(updateData).length > 0 && document_id) {
        await supabase
          .from("booking_documents")
          .update(updateData)
          .eq("id", document_id);
      }

      if (analysis.nome_completo) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("nome_ospite")
          .eq("id", booking_id)
          .single();

        if (booking && (!booking.nome_ospite || booking.nome_ospite === "")) {
          await supabase
            .from("bookings")
            .update({ nome_ospite: analysis.nome_completo })
            .eq("id", booking_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ analysis, applied: analysis.confidence >= 0.6 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI document analysis error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function fetchDocumentImage(
  supabase: ReturnType<typeof createClient>,
  documentUrl: string
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    let url = documentUrl;

    if (!documentUrl.startsWith("http")) {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(documentUrl, 300);

      if (!data?.signedUrl) return null;
      url = data.signedUrl;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    const mediaType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : contentType.includes("pdf")
      ? "application/pdf"
      : "image/jpeg";

    return { base64, mediaType };
  } catch (err) {
    console.error("Fetch document error:", err);
    return null;
  }
}

async function analyzeDocumentWithClaude(
  base64: string,
  mediaType: string
): Promise<DocumentAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return emptyAnalysis();
  }

  const isPdf = mediaType === "application/pdf";

  const prompt = `Analizza questo documento d'identita italiano. Estrai le informazioni e rispondi SOLO con un JSON valido.

Rispondi con questo JSON esatto:
{
  "tipo_documento": "carta_identita|passaporto|patente|codice_fiscale|permesso_soggiorno|altro",
  "nome_completo": "Nome e Cognome completi",
  "codice_fiscale": "codice fiscale se visibile, altrimenti stringa vuota",
  "data_scadenza": "YYYY-MM-DD se visibile, altrimenti null",
  "data_nascita": "YYYY-MM-DD se visibile, altrimenti null",
  "numero_documento": "numero del documento se visibile, altrimenti stringa vuota",
  "confidence": 0.0-1.0
}

Note:
- Se il documento non e leggibile o non e un documento d'identita, metti confidence a 0.1
- Estrai SOLO dati chiaramente leggibili, non indovinare
- Il codice fiscale italiano ha 16 caratteri alfanumerici
- Le date devono essere nel formato YYYY-MM-DD`;

  try {
    const content: any[] = [];

    if (isPdf) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      console.error(`Claude API error: ${response.status}`);
      return emptyAnalysis();
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptyAnalysis();

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      tipo_documento: parsed.tipo_documento || "altro",
      nome_completo: parsed.nome_completo || "",
      codice_fiscale: parsed.codice_fiscale || "",
      data_scadenza: parsed.data_scadenza || null,
      data_nascita: parsed.data_nascita || null,
      numero_documento: parsed.numero_documento || "",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.3)),
    };
  } catch (err) {
    console.error("Claude document analysis error:", err);
    return emptyAnalysis();
  }
}

function emptyAnalysis(): DocumentAnalysis {
  return {
    tipo_documento: "altro",
    nome_completo: "",
    codice_fiscale: "",
    data_scadenza: null,
    data_nascita: null,
    numero_documento: "",
    confidence: 0,
  };
}
