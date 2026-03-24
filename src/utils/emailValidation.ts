export interface EmailValidation {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const POPULAR_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tin.it',
  'tiscali.it',
  'aruba.it',
  'pec.it',
]);

const DOMAIN_CORRECTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmai1.com': 'gmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'outlooko.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho0.com': 'yahoo.com',
  'hotmai.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'libero.iy': 'libero.it',
  'libero.i': 'libero.it',
  'libero.com': 'libero.it',
  'virgilio.iy': 'virgilio.it',
  'virgilio.i': 'virgilio.it',
  'virgilio.com': 'virgilio.it',
  'alice.iy': 'alice.it',
  'alice.i': 'alice.it',
  'alice.com': 'alice.it',
  'tin.iy': 'tin.it',
  'tin.i': 'tin.it',
  'tiscali.iy': 'tiscali.it',
  'tiscali.i': 'tiscali.it',
  'aruba.iy': 'aruba.it',
  'aruba.i': 'aruba.it',
  'pec.iy': 'pec.it',
  'pec.i': 'pec.it',
};

export function validateEmail(email: string): EmailValidation {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email non può essere vuota' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email troppo lunga (massimo 254 caratteri)' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Formato email non valido' };
  }

  const [localPart, domain] = trimmed.split('@');

  if (localPart.length > 64) {
    return { valid: false, error: 'Parte locale della email troppo lunga (massimo 64 caratteri)' };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'La parte locale non può iniziare o finire con un punto' };
  }

  if (localPart.includes('..')) {
    return { valid: false, error: 'La parte locale contiene punti consecutivi' };
  }

  if (!domain.includes('.')) {
    return { valid: false, error: 'Dominio non valido' };
  }

  return { valid: true };
}

export function suggestEmailCorrection(email: string): string | null {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex === -1) {
    return null;
  }

  const localPart = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1).toLowerCase();

  const correction = DOMAIN_CORRECTIONS[domain];
  if (correction) {
    return `${localPart}@${correction}`;
  }

  return null;
}

export function isEmailConfigured(): boolean {
  return true;
}
