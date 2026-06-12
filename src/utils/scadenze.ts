import { parseISO, addDays, isBefore, isSameDay, startOfDay, format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

export interface ScadenzaItem { scadenza: string; stato?: string | null; [k: string]: any; }
export interface DayGroup<T> { date: string; label: string; isToday: boolean; items: T[]; }
export interface Buckets<T> {
  overdue: T[];
  thisWeek: DayGroup<T>[];
  thisMonth: T[];
  later: T[];
  paid: T[];
}

// `getDate` permette di usarlo sia con `scadenza` (spese) sia con `data_scadenza` (incassi)
export function bucketByScadenza<T extends Record<string, any>>(
  items: T[],
  now: Date = new Date(),
  getDate: (i: T) => string = (i) => i.scadenza,
): Buckets<T> {
  const todayStart = startOfDay(now);
  const in7 = addDays(todayStart, 7);
  const in30 = addDays(todayStart, 30);

  const paid = items.filter(i => i.stato === 'pagato');
  const open = items.filter(i => i.stato !== 'pagato');

  const overdue: T[] = [];
  const week: T[] = [];
  const month: T[] = [];
  const later: T[] = [];

  for (const i of open) {
    const d = parseISO(getDate(i));
    const dStart = startOfDay(d);

    // Past: strictly before today's start (i.e., not today, not future)
    if (isBefore(dStart, todayStart)) { overdue.push(i); continue; }
    // Today or within 7 days
    if (isSameDay(d, now) || isBefore(dStart, in7)) { week.push(i); continue; }
    // Within 30 days
    if (isBefore(dStart, in30)) { month.push(i); continue; }
    later.push(i);
  }

  const byDay: Record<string, T[]> = {};
  for (const i of week) {
    const key = format(parseISO(getDate(i)), 'yyyy-MM-dd');
    (byDay[key] ||= []).push(i);
  }
  const thisWeek: DayGroup<T>[] = Object.keys(byDay).sort().map(date => {
    const d = parseISO(date);
    const today = isSameDay(d, now);
    const label = (today ? 'Oggi — ' : '') + format(d, 'EEEE d MMM', { locale: itLocale });
    return { date, label: label.charAt(0).toUpperCase() + label.slice(1), isToday: today, items: byDay[date] };
  });

  return { overdue, thisWeek, thisMonth: month, later, paid };
}
