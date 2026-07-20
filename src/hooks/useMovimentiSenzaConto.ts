import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUnassigned, type MovSenzaConto } from '@/utils/movimentiSenzaConto';

export function useMovimentiSenzaConto() {
  const qc = useQueryClient();

  const list = useQuery<MovSenzaConto[]>({
    queryKey: ['movimenti-senza-conto'],
    queryFn: async () => {
      const [{ data: spese }, { data: incassi }] = await Promise.all([
        supabase
          .from('payments')
          .select('id, importo, data_pagamento, descrizione, property_real_id, property_mobile_id, properties_real(nome, gestione_id), properties_mobile(veicolo, gestione_id)')
          .is('conto_id', null)
          .eq('stato', 'pagato'),
        supabase
          .from('tenant_payments')
          .select('id, importo, payment_date, data_scadenza, description, notes, bookings(properties_real(nome, gestione_id))')
          .is('conto_id', null)
          .eq('stato', 'pagato'),
      ]);
      return normalizeUnassigned(spese || [], incassi || []);
    },
  });

  const assegna = useMutation({
    mutationFn: async (assignments: Array<{ id: string; tipo: 'spesa' | 'incasso'; conto_id: string }>) => {
      const spese = assignments.filter(a => a.tipo === 'spesa');
      const incassi = assignments.filter(a => a.tipo === 'incasso');
      for (const a of spese) {
        const { error } = await supabase.from('payments').update({ conto_id: a.conto_id }).eq('id', a.id);
        if (error) throw error;
      }
      for (const a of incassi) {
        const { error } = await supabase.from('tenant_payments').update({ conto_id: a.conto_id }).eq('id', a.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimenti-senza-conto'] });
      qc.invalidateQueries({ queryKey: ['cassa'] });
      qc.invalidateQueries({ queryKey: ['conti'] });
      qc.invalidateQueries({ queryKey: ['unified-expenses'] });
    },
  });

  return { ...list, assegna };
}
