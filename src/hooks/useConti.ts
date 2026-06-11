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

  return { ...list, createConto, updateConto };
}
