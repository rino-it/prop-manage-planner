import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useConti() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['conti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conti').select('*').eq('archived', false).order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const createConto = useMutation({
    mutationFn: async (c: { gestione_id: string; nome: string; tipo: string; saldo_iniziale: number; data_apertura: string; }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('conti').insert({ ...c, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conti'] }),
  });

  const updateConto = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; nome?: string; saldo_iniziale?: number; data_apertura?: string; archived?: boolean; }) => {
      const { error } = await supabase.from('conti').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conti'] }),
  });

  const deleteConto = useMutation({
    mutationFn: async (id: string) => {
      // Sgancia i movimenti assegnati: tornano "senza conto" anziché perdersi.
      const { error: e1 } = await supabase.from('payments').update({ conto_id: null }).eq('conto_id', id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('tenant_payments').update({ conto_id: null }).eq('conto_id', id);
      if (e2) throw e2;
      // I giroconti collegati vengono rimossi via ON DELETE CASCADE.
      const { error: e3 } = await supabase.from('conti').delete().eq('id', id);
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conti'] });
      qc.invalidateQueries({ queryKey: ['cassa'] });
      qc.invalidateQueries({ queryKey: ['movimenti-senza-conto'] });
      qc.invalidateQueries({ queryKey: ['unified-expenses'] });
    },
  });

  return { ...list, createConto, updateConto, deleteConto };
}
