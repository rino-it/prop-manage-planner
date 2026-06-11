import { describe, it, expect } from 'vitest';
import { bucketByScadenza } from './scadenze';

const mk = (id: string, scadenza: string, stato = 'da_pagare') => ({ id, scadenza, stato });

describe('bucketByScadenza', () => {
  const now = new Date('2026-06-11T14:00:00'); // giovedì

  it('una scadenza di OGGI finisce in thisWeek, mai persa', () => {
    const r = bucketByScadenza([mk('a', '2026-06-11')], now);
    expect(r.overdue.map(x => x.id)).toEqual([]);
    const todayIds = r.thisWeek.flatMap(g => g.items.map(i => i.id));
    expect(todayIds).toContain('a');
  });

  it('una scadenza passata (non oggi) finisce in overdue', () => {
    const r = bucketByScadenza([mk('b', '2026-06-01')], now);
    expect(r.overdue.map(x => x.id)).toEqual(['b']);
  });

  it('thisWeek è suddiviso per giorno, oggi in cima', () => {
    const r = bucketByScadenza([mk('c', '2026-06-13'), mk('d', '2026-06-11')], now);
    expect(r.thisWeek[0].date).toBe('2026-06-11');
    expect(r.thisWeek[0].isToday).toBe(true);
    expect(r.thisWeek.map(g => g.date)).toEqual(['2026-06-11', '2026-06-13']);
  });

  it('oltre 7 giorni va in thisMonth, oltre 30 in later', () => {
    const r = bucketByScadenza([mk('e', '2026-06-25'), mk('f', '2026-08-01')], now);
    expect(r.thisMonth.map(x => x.id)).toEqual(['e']);
    expect(r.later.map(x => x.id)).toEqual(['f']);
  });

  it('le voci pagate vanno in paid', () => {
    const r = bucketByScadenza([mk('g', '2026-06-01', 'pagato')], now);
    expect(r.paid.map(x => x.id)).toEqual(['g']);
  });
});
