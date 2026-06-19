import { describe, it, expect } from 'vitest';
import { mesiPerFrequenza, distribuisciImporti, generateRate, derivePianoStats } from './rientri';

describe('mesiPerFrequenza', () => {
  it('mappa le frequenze', () => {
    expect(mesiPerFrequenza('mensile')).toBe(1);
    expect(mesiPerFrequenza('bimestrale')).toBe(2);
    expect(mesiPerFrequenza('trimestrale')).toBe(3);
    expect(mesiPerFrequenza('semestrale')).toBe(6);
    expect(mesiPerFrequenza('annuale')).toBe(12);
    expect(mesiPerFrequenza('personalizzata')).toBe(0);
  });
});

describe('distribuisciImporti', () => {
  it('somma esatta con arrotondamento sull ultima', () => {
    const r = distribuisciImporti(100, 3);
    expect(r).toEqual([33.33, 33.33, 33.34]);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });
  it('importi tondi', () => {
    expect(distribuisciImporti(6000, 6)).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
  });
});

describe('generateRate', () => {
  it('genera date mensili e somma esatta', () => {
    const rate = generateRate({ importoTotale: 100, numeroRate: 3, frequenza: 'mensile', dataPrimaRata: '2026-01-31' });
    expect(rate.map(r => r.scadenza)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(rate.reduce((a, b) => a + b.importo, 0)).toBeCloseTo(100, 2);
  });
  it('trimestrale', () => {
    const rate = generateRate({ importoTotale: 300, numeroRate: 2, frequenza: 'trimestrale', dataPrimaRata: '2026-01-15' });
    expect(rate.map(r => r.scadenza)).toEqual(['2026-01-15', '2026-04-15']);
  });
});

describe('derivePianoStats', () => {
  const now = new Date('2026-06-19T00:00:00');
  it('calcola residuo, pagate, prossima, ritardo', () => {
    const rate = [
      { importo: 100, stato: 'pagato', scadenza: '2026-05-01', rata_numero: 1 },
      { importo: 100, stato: 'in_attesa', scadenza: '2026-06-01', rata_numero: 2 },
      { importo: 100, stato: 'in_attesa', scadenza: '2026-07-01', rata_numero: 3 },
    ];
    const s = derivePianoStats(rate, 300, now);
    expect(s.totaleRate).toBe(3);
    expect(s.ratePagate).toBe(1);
    expect(s.importoPagato).toBe(100);
    expect(s.residuo).toBe(200);
    expect(s.percentuale).toBeCloseTo(33.33, 1);
    expect(s.prossimaRata?.rata_numero).toBe(2);
    expect(s.inRitardo).toBe(true);
  });
  it('rimborsato conta come pagato (crediti)', () => {
    const rate = [{ importo: 50, stato: 'rimborsato', is_advance: true, scadenza: '2026-05-01' }];
    const s = derivePianoStats(rate, 50, now);
    expect(s.importoPagato).toBe(50);
    expect(s.residuo).toBe(0);
    expect(s.prossimaRata).toBeNull();
  });
});
