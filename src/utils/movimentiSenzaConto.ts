export interface MovSenzaConto {
  id: string;
  tipo: 'spesa' | 'incasso';
  data: string;
  descrizione: string;
  proprieta: string;
  gestione_id: string | null;
  importo: number;
}

export function normalizeUnassigned(spese: any[], incassi: any[]): MovSenzaConto[] {
  const out: MovSenzaConto[] = [];

  for (const sp of spese || []) {
    const real = sp.properties_real;
    const mob = sp.properties_mobile;
    out.push({
      id: sp.id,
      tipo: 'spesa',
      data: sp.data_pagamento || '',
      descrizione: sp.descrizione || 'Spesa',
      proprieta: real?.nome || mob?.veicolo || '',
      gestione_id: real?.gestione_id ?? mob?.gestione_id ?? null,
      importo: Number(sp.importo),
    });
  }

  for (const inc of incassi || []) {
    const real = inc.bookings?.properties_real || inc.properties_real;
    out.push({
      id: inc.id,
      tipo: 'incasso',
      data: inc.payment_date || inc.data_scadenza || '',
      descrizione: inc.description || inc.notes || 'Incasso',
      proprieta: real?.nome || '',
      gestione_id: real?.gestione_id ?? null,
      importo: Number(inc.importo),
    });
  }

  return out;
}
