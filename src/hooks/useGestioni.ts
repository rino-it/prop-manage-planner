import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGestioni() {
  return useQuery({
    queryKey: ['gestioni'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gestioni').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}
