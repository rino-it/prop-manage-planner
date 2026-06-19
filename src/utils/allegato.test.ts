import { describe, it, expect } from 'vitest';
import {
  isAllegatoTypeValid,
  buildAllegatoPath,
  displayNameFromPath,
  ALLEGATO_MAX_BYTES,
} from './allegato';

describe('isAllegatoTypeValid', () => {
  it('accetta PDF e immagini', () => {
    expect(isAllegatoTypeValid({ type: 'application/pdf' })).toBe(true);
    expect(isAllegatoTypeValid({ type: 'image/jpeg' })).toBe(true);
    expect(isAllegatoTypeValid({ type: 'image/png' })).toBe(true);
  });
  it('rifiuta altri tipi', () => {
    expect(isAllegatoTypeValid({ type: 'text/plain' })).toBe(false);
    expect(isAllegatoTypeValid({ type: 'application/zip' })).toBe(false);
  });
});

describe('buildAllegatoPath', () => {
  it('usa prefisso spese/, timestamp e sostituisce gli spazi', () => {
    expect(buildAllegatoPath('Fattura TARI.pdf', 1718800000000))
      .toBe('spese/1718800000000_Fattura_TARI.pdf');
  });
});

describe('displayNameFromPath', () => {
  it('rimuove cartella e prefisso timestamp', () => {
    expect(displayNameFromPath('spese/1718800000000_Fattura_TARI.pdf'))
      .toBe('Fattura_TARI.pdf');
  });
  it('gestisce un path senza prefisso', () => {
    expect(displayNameFromPath('Documento.pdf')).toBe('Documento.pdf');
  });
  it('rimuove cartella e prefisso timestamp anche con timestamp corto', () => {
    expect(displayNameFromPath('other/1_a.pdf')).toBe('a.pdf');
  });
  it('non tocca cifre non seguite da underscore', () => {
    expect(displayNameFromPath('123abc_name.pdf')).toBe('123abc_name.pdf');
  });
});

describe('ALLEGATO_MAX_BYTES', () => {
  it('vale 10 MB', () => {
    expect(ALLEGATO_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
