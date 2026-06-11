import { describe, it, expect } from 'vitest';
import { saldoConto } from './cassa';

const conto = { id: 'c1', saldo_iniziale: 1000, data_apertura: '2026-06-01' };

describe('saldoConto', () => {
  it('parte dal saldo iniziale senza movimenti', () => {
    expect(saldoConto(conto, { incassi: [], spese: [], giroconti: [] })).toBe(1000);
  });

  it('somma incassi pagati e sottrae spese pagate dopo data_apertura', () => {
    const r = saldoConto(conto, {
      incassi: [{ conto_id: 'c1', importo: 500, payment_date: '2026-06-05', stato: 'pagato' }],
      spese:   [{ conto_id: 'c1', importo: 200, data_pagamento: '2026-06-06', stato: 'pagato' }],
      giroconti: [],
    });
    expect(r).toBe(1300);
  });

  it('ignora movimenti prima di data_apertura e non pagati', () => {
    const r = saldoConto(conto, {
      incassi: [
        { conto_id: 'c1', importo: 999, payment_date: '2026-05-01', stato: 'pagato' },
        { conto_id: 'c1', importo: 999, payment_date: '2026-06-10', stato: 'da_pagare' },
      ],
      spese: [], giroconti: [],
    });
    expect(r).toBe(1000);
  });

  it('applica i giroconti in entrata e uscita', () => {
    const r = saldoConto(conto, {
      incassi: [], spese: [],
      giroconti: [
        { conto_from: 'c1', conto_to: 'cX', importo: 100, data: '2026-06-07' },
        { conto_from: 'cY', conto_to: 'c1', importo: 50,  data: '2026-06-08' },
      ],
    });
    expect(r).toBe(950);
  });
});
