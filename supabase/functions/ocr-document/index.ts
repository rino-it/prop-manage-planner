import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface ExtractedFields {
  nome: string | null;
  cognome: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  codice_fiscale: string | null;
  numero_documento: string | null;
  data_scadenza: string | null;
}

interface OcrResponse {
  success: boolean;
  extracted: ExtractedFields;
  raw_text: string;
  error?: string;
}

function extractItalianFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {
    nome: null,
    cognome: null,
    data_nascita: null,
    luogo_nascita: null,
    codice_fiscale: null,
    numero_documento: null,
    data_scadenza: null,
  };

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();

    if (line.includes("NOME") && !fields.nome) {
      fields.nome = extractValueAfterLabel(line, "NOME");
    }

    if (line.includes("COGNOME") && !fields.cognome) {
      fields.cognome = extractValueAfterLabel(line, "COGNOME");
    }

    if (line.includes("DATA DI NASCITA") && !fields.data_nascita) {
      fields.data_nascita = extractValueAfterLabel(line, "DATA DI NASCITA");
    }

    if (line.includes("LUOGO DI NASCITA") && !fields.luogo_nascita) {
      fields.luogo_nascita = extractValueAfterLabel(line, "LUOGO DI NASCITA");
    }

    if (line.includes("CODICE FISCALE") && !fields.codice_fiscale) {
      const cf = extractValueAfterLabel(line, "CODICE FISCALE");
      if (cf && /^[A-Z0-9]{16}$/.test(cf)) {
        fields.codice_fiscale = cf;
      }
    }

    if (line.includes("NUMERO") && !fields.numero_documento) {
      const num = extractValueAfterLabel(line, "NUMERO");
      if (num && num.length > 0) {
        fields.numero_documento = num;
      }
    }

    if (
      (line.includes("SCADENZA") || line.includes("EXPIRES")) &&
      !fields.data_scadenza
    ) {
      const label = line.includes("SCADENZA") ? "SCADENZA" : "EXPIRES";
      fields.data_scadenza = extractValueAfterLabel(line, label);
    }
  }

  return fields;
}

function extractValueAfterLabel(line: string, label: string): string | null {
  const index = line.indexOf(label);
  if (index === -1) return null;

  const afterLabel = line.substring(index + label.length).trim();
  if (afterLabel.length === 0) return null;

  const value = afterLabel.replace(/^[:/\-\s]+/, "").trim();
  return value.length > 0 ? value : null;
}

async function callOcrSpace(base64Image: string): Promise<string> {
  const apiKey = Deno.env.get("OCR_SPACE_API_KEY");
  if (!apiKey) {
    throw new Error("OCR_SPACE_API_KEY not configured");
  }

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Image: `data:image/jpeg;base64,${base64Image}`,
      apikey: apiKey,
      language: "ita",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OCR.space API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data.IsErroredOnProcessing && data.ParsedText) {
    return data.ParsedText;
  }

  throw new Error(
    `OCR parsing failed: ${data.ErrorMessage || "Unknown error"}`
  );
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid image parameter" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const rawText = await callOcrSpace(image);
    const extracted = extractItalianFields(rawText);

    const response: OcrResponse = {
      success: true,
      extracted,
      raw_text: rawText,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const response: OcrResponse = {
      success: false,
      extracted: {
        nome: null,
        cognome: null,
        data_nascita: null,
        luogo_nascita: null,
        codice_fiscale: null,
        numero_documento: null,
        data_scadenza: null,
      },
      raw_text: "",
      error: errorMessage,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
