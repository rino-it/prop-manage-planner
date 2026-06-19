/** Dimensione massima consentita per un allegato spesa: 10 MB. */
export const ALLEGATO_MAX_BYTES = 10 * 1024 * 1024;

/** Accetta solo PDF o immagini. */
export function isAllegatoTypeValid(file: { type: string }): boolean {
  return file.type === 'application/pdf' || file.type.startsWith('image/');
}

/**
 * Costruisce il path nel bucket `documents` per l'allegato di una spesa.
 * Formato: `spese/{timestamp}_{nome sanificato}`.
 * `nowMs` è iniettabile per i test.
 */
export function buildAllegatoPath(fileName: string, nowMs: number = Date.now()): string {
  const safe = fileName.replace(/\s+/g, '_');
  return `spese/${nowMs}_${safe}`;
}

/** Deriva un nome leggibile dal path salvato (rimuove cartella e prefisso timestamp). */
export function displayNameFromPath(path: string): string {
  const last = path.split('/').pop() ?? '';
  return last.replace(/^\d+_/, '');
}
