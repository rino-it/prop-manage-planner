import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGiroconti() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['giroconti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('giroconti').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const createGiroconto = useMutation({
    mutationFn: async (g: { conto_from: string; conto_to: string; importo: number; data: string; descrizione?: string; }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('giroconti').insert({ ...g, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['giroconti'] }); qc.invalidateQueries({ queryKey: ['conti'] }); },
  });
  return { ...list, createGiroconto };
}
