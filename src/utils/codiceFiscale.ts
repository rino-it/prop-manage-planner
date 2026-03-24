const ODD_MAP: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const REMAINDER_LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const MONTH_CODES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, H: 6, L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
};

export interface CodiceFiscaleValidation {
  valid: boolean;
  errors: string[];
  parsed?: {
    surname: string;
    name: string;
    birthYear: string;
    birthMonth: number;
    birthDay: number;
    gender: "M" | "F";
    birthPlace: string;
  };
}

export function validateCodiceFiscale(cf: string): CodiceFiscaleValidation {
  const errors: string[] = [];

  if (!cf || typeof cf !== "string") {
    return { valid: false, errors: ["Codice fiscale mancante"] };
  }

  const normalized = cf.toUpperCase().trim();

  // Lunghezza
  if (normalized.length !== 16) {
    return { valid: false, errors: ["Il codice fiscale deve avere 16 caratteri"] };
  }

  // Formato: 6 lettere + 2 numeri + 1 lettera + 2 numeri + 1 lettera + 3 alfanum + 1 lettera
  const cfRegex = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
  if (!cfRegex.test(normalized)) {
    errors.push("Formato non valido (atteso: 6 lettere, 2 cifre, 1 lettera, 2 cifre, 1 lettera, 3 cifre, 1 lettera)");
  }

  // Verifica check digit (carattere di controllo)
  if (errors.length === 0) {
    const checkDigit = computeCheckDigit(normalized.substring(0, 15));
    if (checkDigit !== normalized[15]) {
      errors.push(`Carattere di controllo non valido (atteso: ${checkDigit}, trovato: ${normalized[15]})`);
    }
  }

  // Verifica mese
  const monthChar = normalized[8];
  if (!MONTH_CODES[monthChar]) {
    errors.push(`Codice mese non valido: ${monthChar}`);
  }

  // Verifica giorno (1-31 per maschi, 41-71 per femmine)
  const dayNum = parseInt(normalized.substring(9, 11), 10);
  if (isNaN(dayNum) || (dayNum < 1 || (dayNum > 31 && dayNum < 41) || dayNum > 71)) {
    errors.push(`Giorno non valido: ${dayNum}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const gender: "M" | "F" = dayNum > 40 ? "F" : "M";
  const actualDay = dayNum > 40 ? dayNum - 40 : dayNum;

  return {
    valid: true,
    errors: [],
    parsed: {
      surname: normalized.substring(0, 3),
      name: normalized.substring(3, 6),
      birthYear: normalized.substring(6, 8),
      birthMonth: MONTH_CODES[monthChar],
      birthDay: actualDay,
      gender,
      birthPlace: normalized.substring(11, 15),
    },
  };
}

function computeCheckDigit(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = first15[i];
    if (i % 2 === 0) {
      sum += ODD_MAP[char] ?? 0;
    } else {
      sum += EVEN_MAP[char] ?? 0;
    }
  }
  return REMAINDER_LETTER[sum % 26];
}

export function formatCodiceFiscale(cf: string): string {
  return cf.toUpperCase().replace(/\s/g, "").trim();
}
