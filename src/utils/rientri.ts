import { parseISO, addMonths, format, isBefore, startOfDay } from 'date-fns';

export type Frequenza = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'personalizzata';

export interface RataInput { scadenza: string; importo: number; }

export function mesiPerFrequenza(f: Frequenza): number {
  switch (f) {
    case 'mensile': return 1;
    case 'bimestrale': return 2;
    case 'trimestrale': return 3;
    case 'semestrale': return 6;
    case 'annuale': return 12;
    default: return 0;
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Split equo a 2 decimali: l'ultima rata assorbe la differenza di arrotondamento
// così la somma torna esatta al centesimo.
export function distribuisciImporti(importoTotale: number, n: number): number[] {
  if (n <= 0) return [];
  const base = r2(importoTotale / n);
  const arr = Array.from({ length: n }, () => base);
  const somma = r2(base * n);
  arr[n - 1] = r2(arr[n - 1] + (importoTotale - somma));
  return arr;
}

export function generateRate(opts: {
  importoTotale: number; numeroRate: number; frequenza: Frequenza; dataPrimaRata: string;
}): RataInput[] {
  const { importoTotale, numeroRate, frequenza, dataPrimaRata } = opts;
  const importi = distribuisciImporti(importoTotale, numeroRate);
  const step = mesiPerFrequenza(frequenza) || 1;
  const start = parseISO(dataPrimaRata);
  return importi.map((importo, k) => ({
    importo,
    scadenza: format(addMonths(start, k * step), 'yyyy-MM-dd'),
  }));
}

export interface RataLike {
  importo: number; stato?: string | null; is_advance?: boolean | null;
  scadenza: string; rata_numero?: number | null;
}
export interface PianoStats {
  totaleRate: number; ratePagate: number; importoPagato: number;
  residuo: number; percentuale: number; prossimaRata: RataLike | null; inRitardo: boolean;
}

const isPagata = (r: RataLike) => r.stato === 'pagato' || r.stato === 'rimborsato';

export function derivePianoStats(rate: RataLike[], importoTotale: number, now: Date = new Date()): PianoStats {
  const totaleRate = rate.length;
  const pagate = rate.filter(isPagata);
  const importoPagato = r2(pagate.reduce((s, r) => s + Number(r.importo), 0));
  const residuo = r2(importoTotale - importoPagato);
  const percentuale = importoTotale > 0 ? (importoPagato / importoTotale) * 100 : 0;
  const nonPagate = rate.filter(r => !isPagata(r)).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const prossimaRata = nonPagate[0] ?? null;
  const today = startOfDay(now);
  const inRitardo = nonPagate.some(r => isBefore(startOfDay(parseISO(r.scadenza)), today));
  return { totaleRate, ratePagate: pagate.length, importoPagato, residuo, percentuale, prossimaRata, inRitardo };
}
