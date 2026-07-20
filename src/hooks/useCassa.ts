import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { saldoConto, dataIncasso } from '@/utils/cassa';

export function useCassa() {
  return useQuery({
    queryKey: ['cassa'],
    queryFn: async () => {
      const [{ data: conti }, { data: incassi }, { data: spese }, { data: giroconti }] = await Promise.all([
        supabase.from('conti').select('*').eq('archived', false),
        supabase.from('tenant_payments').select('conto_id, importo, payment_date, data_scadenza, stato'),
        supabase.from('payments').select('conto_id, importo, data_pagamento, stato'),
        supabase.from('giroconti').select('conto_from, conto_to, importo, data'),
      ]);
      const mov = { incassi: incassi || [], spese: spese || [], giroconti: giroconti || [] };

      // Data dell'ultimo movimento per conto (per il badge "Xg fa" sulle card).
      const lastByConto = new Map<string, string>();
      const bump = (id: string | null | undefined, d: string | null | undefined) => {
        if (!id || !d) return;
        const day = d.slice(0, 10);
        const prev = lastByConto.get(id);
        if (!prev || day > prev) lastByConto.set(id, day);
      };
      for (const i of incassi || []) if (i.stato === 'pagato') bump(i.conto_id, dataIncasso(i));
      for (const s of spese || []) if (s.stato === 'pagato') bump(s.conto_id, s.data_pagamento);
      for (const g of giroconti || []) { bump(g.conto_from, g.data); bump(g.conto_to, g.data); }

      return (conti || []).map(c => ({
        ...c,
        saldo: saldoConto(c as any, mov),
        lastMovement: lastByConto.get(c.id) || null,
      }));
    },
  });
}
