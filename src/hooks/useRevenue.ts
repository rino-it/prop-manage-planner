import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RevenueEntry {
  id: string;
  property_id: string;
  amount: number;
  category: 'affitto' | 'extra' | 'rimborso' | 'conguaglio' | 'deposito';
  date: string;
  description: string;
}

export const useRevenue = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. OTTIENI TUTTI GLI INCASSI
  const { data: revenues, isLoading } = useQuery({
    queryKey: ['revenues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenue_entries')
        .select(`
          *,
          properties_real (nome)
        `)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // 2. AGGIUNGI NUOVO INCASSO
  const addRevenue = useMutation({
    mutationFn: async (newRevenue: Omit<RevenueEntry, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non loggato");

      const { error } = await supabase
        .from('revenue_entries')
        .insert({ ...newRevenue, user_id: user.id });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // Aggiornerà la dashboard
      toast({ title: "Incasso Registrato", description: "I dati finanziari sono aggiornati." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  // 3. ELIMINA INCASSO
  const deleteRevenue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('revenue_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: "Eliminato", description: "Voce rimossa correttamente." });
    }
  });

  return {
    revenues,
    isLoading,
    addRevenue,
    deleteRevenue
  };
};