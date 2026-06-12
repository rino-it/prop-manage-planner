import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { saldoConto } from '@/utils/cassa';

export function useCassa() {
  return useQuery({
    queryKey: ['cassa'],
    queryFn: async () => {
      const [{ data: conti }, { data: incassi }, { data: spese }, { data: giroconti }] = await Promise.all([
        supabase.from('conti').select('*').eq('archived', false),
        supabase.from('tenant_payments').select('conto_id, importo, payment_date, stato'),
        supabase.from('payments').select('conto_id, importo, data_pagamento, stato'),
        supabase.from('giroconti').select('conto_from, conto_to, importo, data'),
      ]);
      const mov = { incassi: incassi || [], spese: spese || [], giroconti: giroconti || [] };
      return (conti || []).map(c => ({ ...c, saldo: saldoConto(c as any, mov) }));
    },
  });
}
