export interface MovReport { proprieta: string; entrata: number; uscita: number; }
export interface ReportRow { proprieta: string; entrate: number; uscite: number; netto: number; }

const SENZA_PROPRIETA = '(senza proprietà)';
const round2 = (n: number) => Math.round(n * 100) / 100;

export function aggregaReportProprieta(movs: MovReport[]): {
  rows: ReportRow[]; totEntrate: number; totUscite: number; totNetto: number;
} {
  const byProp = new Map<string, { entrate: number; uscite: number }>();
  for (const m of movs) {
    const key = m.proprieta || SENZA_PROPRIETA;
    const acc = byProp.get(key) || { entrate: 0, uscite: 0 };
    acc.entrate += Number(m.entrata) || 0;
    acc.uscite += Number(m.uscita) || 0;
    byProp.set(key, acc);
  }

  const rows: ReportRow[] = [...byProp.entries()]
    .map(([proprieta, { entrate, uscite }]) => ({
      proprieta,
      entrate: round2(entrate),
      uscite: round2(uscite),
      netto: round2(entrate - uscite),
    }))
    .sort((a, b) => b.netto - a.netto);

  const totEntrate = round2(rows.reduce((s, r) => s + r.entrate, 0));
  const totUscite = round2(rows.reduce((s, r) => s + r.uscite, 0));
  return { rows, totEntrate, totUscite, totNetto: round2(totEntrate - totUscite) };
}
