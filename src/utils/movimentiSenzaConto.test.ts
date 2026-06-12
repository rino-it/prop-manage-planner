import { describe, it, expect } from 'vitest';
import { normalizeUnassigned, type MovSenzaConto } from './movimentiSenzaConto';

describe('normalizeUnassigned', () => {
  const spese = [
    { id: 's1', importo: 100, data_pagamento: '2026-06-05', descrizione: 'Idraulico',
      property_real_id: 'p1', property_mobile_id: null,
      properties_real: { nome: 'Via Roma', gestione_id: 'g1' }, properties_mobile: null },
    { id: 's2', importo: 50, data_pagamento: '2026-06-06', descrizione: 'Bollo',
      property_real_id: null, property_mobile_id: 'm1',
      properties_real: null, properties_mobile: { veicolo: 'Panda', gestione_id: 'g2' } },
    { id: 's3', importo: 30, data_pagamento: '2026-06-07', descrizione: 'Generale',
      property_real_id: null, property_mobile_id: null, properties_real: null, properties_mobile: null },
  ];
  const incassi = [
    { id: 'i1', importo: 500, payment_date: '2026-06-08', description: 'Affitto', notes: null,
      bookings: { properties_real: { nome: 'Via Roma', gestione_id: 'g1' } } },
  ];

  it('unisce spese e incassi con tipo, gestione_id e proprietà', () => {
    const r: MovSenzaConto[] = normalizeUnassigned(spese, incassi);
    expect(r).toHaveLength(4);
    const s1 = r.find(x => x.id === 's1' && x.tipo === 'spesa')!;
    expect(s1.gestione_id).toBe('g1');
    expect(s1.proprieta).toBe('Via Roma');
    expect(s1.importo).toBe(100);
    const s2 = r.find(x => x.id === 's2')!;
    expect(s2.gestione_id).toBe('g2');
    expect(s2.proprieta).toBe('Panda');
    const i1 = r.find(x => x.tipo === 'incasso')!;
    expect(i1.gestione_id).toBe('g1');
    expect(i1.descrizione).toBe('Affitto');
  });

  it('movimenti senza proprietà hanno gestione_id null', () => {
    const r = normalizeUnassigned(spese, incassi);
    const s3 = r.find(x => x.id === 's3')!;
    expect(s3.gestione_id).toBeNull();
    expect(s3.proprieta).toBe('');
  });
});
