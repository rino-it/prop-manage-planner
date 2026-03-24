import { supabase } from "@/integrations/supabase/client";

export interface OcrDocumentResult {
  success: boolean;
  extracted: {
    nome: string | null;
    cognome: string | null;
    data_nascita: string | null;
    luogo_nascita: string | null;
    codice_fiscale: string | null;
    numero_documento: string | null;
    data_scadenza: string | null;
  };
  raw_text: string;
  error?: string;
}

export async function extractDocumentData(
  imageFile: File
): Promise<OcrDocumentResult> {
  const base64 = await fileToBase64(imageFile);
  const cleanBase64 = base64.split(",")[1] || base64;

  const { data, error } = await supabase.functions.invoke("ocr-document", {
    body: { image: cleanBase64 },
  });

  if (error) {
    return {
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
      error: error.message || "Failed to process document",
    };
  }

  return data as OcrDocumentResult;
}

export function isIdentityDocument(file: File): boolean {
  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/tiff"];
  return validMimeTypes.includes(file.type);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
