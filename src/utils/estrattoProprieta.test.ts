import { describe, it, expect } from 'vitest';
import { buildRowsProprieta, type MovProprieta } from './estrattoProprieta';

const contoNome = (id: string | null) => (id ? ({ c1: 'Conto Intesa' } as Record<string, string>)[id] || '—' : '—');

describe('buildRowsProprieta', () => {
  it('ordina per data e calcola il saldo progressivo da 0', () => {
    const movs: MovProprieta[] = [
      { data: '2026-06-10', descrizione: 'Affitto', conto_id: 'c1', entrata: 500, uscita: 0 },
      { data: '2026-06-05', descrizione: 'Idraulico', conto_id: 'c1', entrata: 0, uscita: 200 },
    ];
    const r = buildRowsProprieta(movs, 'Via Roma', contoNome);
    expect(r.rows.map(x => x.descrizione)).toEqual(['Idraulico', 'Affitto']);
    expect(r.rows[0].saldo).toBe(-200);
    expect(r.rows[1].saldo).toBe(300);
    expect(r.totEntrate).toBe(500);
    expect(r.totUscite).toBe(200);
    expect(r.saldoFinale).toBe(300);
  });

  it('formatta la data in dd/MM/yyyy, riempie proprietà e conto', () => {
    const r = buildRowsProprieta(
      [{ data: '2026-06-05', descrizione: 'X', conto_id: 'c1', entrata: 10, uscita: 0 }],
      'Via Roma', contoNome,
    );
    expect(r.rows[0].data).toBe('05/06/2026');
    expect(r.rows[0].proprieta).toBe('Via Roma');
    expect(r.rows[0].conto).toBe('Conto Intesa');
  });

  it('mostra "—" quando il conto manca', () => {
    const r = buildRowsProprieta(
      [{ data: '2026-06-05', descrizione: 'X', conto_id: null, entrata: 0, uscita: 50 }],
      'Via Roma', contoNome,
    );
    expect(r.rows[0].conto).toBe('—');
  });
});
