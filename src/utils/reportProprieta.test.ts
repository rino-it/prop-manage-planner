import { describe, it, expect } from 'vitest';
import { aggregaReportProprieta, type MovReport } from './reportProprieta';

describe('aggregaReportProprieta', () => {
  it('aggrega entrate e uscite per proprietà e ordina per netto decrescente', () => {
    const movs: MovReport[] = [
      { proprieta: 'VILLA MARIA', entrata: 0, uscita: 810 },
      { proprieta: 'VILLA SARDEGNA', entrata: 87.5, uscita: 0 },
      { proprieta: 'VILLA SARDEGNA', entrata: 70, uscita: 44.88 },
      { proprieta: 'VERTOVA 85mq', entrata: 450, uscita: 0 },
    ];
    const r = aggregaReportProprieta(movs);
    expect(r.rows.map(x => x.proprieta)).toEqual(['VERTOVA 85mq', 'VILLA SARDEGNA', 'VILLA MARIA']);
    expect(r.rows[1]).toEqual({ proprieta: 'VILLA SARDEGNA', entrate: 157.5, uscite: 44.88, netto: 112.62 });
    expect(r.totEntrate).toBe(607.5);
    expect(r.totUscite).toBe(854.88);
    expect(r.totNetto).toBeCloseTo(-247.38, 2);
  });

  it('raccoglie i movimenti senza proprietà in "(senza proprietà)"', () => {
    const r = aggregaReportProprieta([
      { proprieta: '', entrata: 300, uscita: 0 },
      { proprieta: 'VERTOVA 70mq', entrata: 600, uscita: 0 },
    ]);
    expect(r.rows.map(x => x.proprieta)).toEqual(['VERTOVA 70mq', '(senza proprietà)']);
    expect(r.totEntrate).toBe(900);
  });

  it('senza movimenti restituisce tabella vuota e totali a zero', () => {
    const r = aggregaReportProprieta([]);
    expect(r.rows).toEqual([]);
    expect(r.totEntrate).toBe(0);
    expect(r.totUscite).toBe(0);
    expect(r.totNetto).toBe(0);
  });

  it('evita gli errori di virgola mobile sui netti', () => {
    const r = aggregaReportProprieta([
      { proprieta: 'A', entrata: 0.1, uscita: 0 },
      { proprieta: 'A', entrata: 0.2, uscita: 0 },
    ]);
    expect(r.rows[0].entrate).toBe(0.3);
    expect(r.rows[0].netto).toBe(0.3);
  });
});
