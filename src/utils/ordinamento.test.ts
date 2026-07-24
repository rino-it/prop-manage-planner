import { describe, it, expect } from 'vitest';
import { bucketByScadenza } from './scadenze';

// Garanzie di ordinamento di bucketByScadenza:
// - liste aperte (overdue, thisMonth, later, items dei DayGroup) per scadenza crescente;
// - paid per payment_date ?? data_pagamento ?? scadenza decrescente.
const mk = (id: string, scadenza: string, extra: Record<string, any> = {}) =>
  ({ id, scadenza, stato: 'da_pagare', ...extra });

describe('bucketByScadenza — ordinamenti', () => {
  const now = new Date('2026-06-11T14:00:00'); // giovedì

  it('overdue è ordinato per scadenza crescente', () => {
    const r = bucketByScadenza([
      mk('a', '2026-06-05'),
      mk('b', '2026-05-20'),
      mk('c', '2026-06-01'),
    ], now);
    expect(r.overdue.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('thisMonth è ordinato per scadenza crescente', () => {
    const r = bucketByScadenza([
      mk('a', '2026-07-05'),
      mk('b', '2026-06-20'),
      mk('c', '2026-06-25'),
    ], now);
    expect(r.thisMonth.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('later è ordinato per scadenza crescente', () => {
    const r = bucketByScadenza([
      mk('a', '2026-09-01'),
      mk('b', '2026-07-20'),
      mk('c', '2026-08-15'),
    ], now);
    expect(r.later.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('gli items di ogni DayGroup restano raggruppati per giorno in ordine crescente', () => {
    const r = bucketByScadenza([
      mk('a', '2026-06-13'),
      mk('b', '2026-06-11'),
      mk('c', '2026-06-12'),
      mk('d', '2026-06-11'),
    ], now);
    expect(r.thisWeek.map(g => g.date)).toEqual(['2026-06-11', '2026-06-12', '2026-06-13']);
    expect(r.thisWeek[0].items.map(x => x.id)).toEqual(['b', 'd']);
  });

  it('funziona con getDate custom (data_scadenza degli incassi)', () => {
    const items = [
      { id: 'a', data_scadenza: '2026-06-05', stato: 'da_pagare' },
      { id: 'b', data_scadenza: '2026-05-20', stato: 'da_pagare' },
    ];
    const r = bucketByScadenza(items, now, i => i.data_scadenza);
    expect(r.overdue.map(x => x.id)).toEqual(['b', 'a']);
  });

  it('paid è ordinato per payment_date decrescente', () => {
    const r = bucketByScadenza([
      mk('a', '2026-06-01', { stato: 'pagato', payment_date: '2026-06-03' }),
      mk('b', '2026-06-01', { stato: 'pagato', payment_date: '2026-06-10' }),
      mk('c', '2026-06-01', { stato: 'pagato', payment_date: '2026-06-05' }),
    ], now);
    expect(r.paid.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('paid usa il fallback payment_date ?? data_pagamento ?? scadenza', () => {
    const r = bucketByScadenza([
      mk('a', '2026-06-01', { stato: 'pagato' }),                               // fallback scadenza
      mk('b', '2026-05-01', { stato: 'pagato', data_pagamento: '2026-06-09' }), // fallback data_pagamento
      mk('c', '2026-05-01', { stato: 'pagato', payment_date: '2026-06-05' }),
    ], now);
    expect(r.paid.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('paid gestisce data_pagamento con timestamp completo (slice ISO)', () => {
    const r = bucketByScadenza([
      mk('a', '2026-06-01', { stato: 'pagato', data_pagamento: '2026-06-05T08:00:00+00:00' }),
      mk('b', '2026-06-01', { stato: 'pagato', data_pagamento: '2026-06-07T08:00:00+00:00' }),
    ], now);
    expect(r.paid.map(x => x.id)).toEqual(['b', 'a']);
  });
});
