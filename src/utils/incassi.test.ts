import { describe, it, expect } from 'vitest';
import { buildPaymentRows } from './incassi';

const base = {
  booking_id: 'b1', amount: 500, date_start: new Date('2026-09-01T00:00:00'),
  months: 3, category: 'canone_locazione', description: 'Acconto', is_recurring: false,
};

describe('buildPaymentRows', () => {
  it('singolo da incassare: 1 riga da_pagare senza campi pagamento', () => {
    const rows = buildPaymentRows(base, 'u1', null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      booking_id: 'b1', importo: 500, data_scadenza: '2026-09-01',
      category: 'canone_locazione', notes: 'Acconto', stato: 'da_pagare',
      is_recurring: false, recurrence_group_id: null, user_id: 'u1',
    });
    expect(rows[0].payment_date).toBeUndefined();
    expect(rows[0].payment_type).toBeUndefined();
  });

  it('singolo già incassato: 1 riga pagato con data/metodo/conto', () => {
    const rows = buildPaymentRows(
      { ...base, already_paid: true, payment_method: 'contanti', conto_id: 'c9' },
      'u1', null,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stato: 'pagato', data_scadenza: '2026-09-01',
      payment_date: new Date('2026-09-01T00:00:00').toISOString(),
      payment_type: 'contanti', conto_id: 'c9',
    });
  });

  it('già incassato senza conto: conto_id null e metodo default bonifico', () => {
    const rows = buildPaymentRows({ ...base, already_paid: true, conto_id: '' }, 'u1', null);
    expect(rows[0]).toMatchObject({ stato: 'pagato', conto_id: null, payment_type: 'bonifico' });
  });

  it('ricorrente: genera months righe da_pagare ignorando already_paid', () => {
    const rows = buildPaymentRows(
      { ...base, is_recurring: true, already_paid: true }, 'u1', 'g1',
    );
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.stato)).toEqual(['da_pagare', 'da_pagare', 'da_pagare']);
    expect(rows[0]).toMatchObject({ data_scadenza: '2026-09-01', notes: 'Acconto (Rata 1/3)', recurrence_group_id: 'g1' });
    expect(rows[2]).toMatchObject({ data_scadenza: '2026-11-01', notes: 'Acconto (Rata 3/3)' });
  });
});
