import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
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

    const analysis = await analyzeDocumentWithGemini(imageData.base64, imageData.mediaType);

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

async function analyzeDocumentWithGemini(
  base64: string,
  mediaType: string
): Promise<DocumentAnalysis> {
  if (!GOOGLE_API_KEY) {
    return emptyAnalysis();
  }

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
    const requestBody: any = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mediaType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return emptyAnalysis();
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return emptyAnalysis();
    }

    const parsed = JSON.parse(text);
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
    console.error("Gemini document analysis error:", err);
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
