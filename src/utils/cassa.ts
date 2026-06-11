export interface ContoBase { id: string; saldo_iniziale: number; data_apertura: string; }
export interface Incasso { conto_id?: string | null; importo: number; payment_date?: string | null; stato?: string | null; }
export interface Spesa   { conto_id?: string | null; importo: number; data_pagamento?: string | null; stato?: string | null; }
export interface Giroconto { conto_from: string; conto_to: string; importo: number; data: string; }

export function saldoConto(
  conto: ContoBase,
  mov: { incassi: Incasso[]; spese: Spesa[]; giroconti: Giroconto[] },
): number {
  const apertura = conto.data_apertura;
  const after = (d?: string | null) => !!d && d >= apertura;

  let saldo = Number(conto.saldo_iniziale) || 0;

  for (const i of mov.incassi)
    if (i.conto_id === conto.id && i.stato === 'pagato' && after(i.payment_date)) saldo += Number(i.importo);

  for (const s of mov.spese)
    if (s.conto_id === conto.id && s.stato === 'pagato' && after(s.data_pagamento)) saldo -= Number(s.importo);

  for (const g of mov.giroconti) {
    if (!after(g.data)) continue;
    if (g.conto_to === conto.id)   saldo += Number(g.importo);
    if (g.conto_from === conto.id) saldo -= Number(g.importo);
  }
  return saldo;
}
