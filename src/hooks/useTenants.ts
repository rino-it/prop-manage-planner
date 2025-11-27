import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTenants = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. OTTIENI LISTA INQUILINI (Solo Affitti Lunghi)
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      // Join tra bookings e tenant_profiles
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties_real (nome),
          tenant_profiles (*)
        `)
        .eq('tipo_affitto', 'lungo')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // 2. AGGIORNA SCORE E NOTE
  const updateProfile = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase
        .from('tenant_profiles')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: "Profilo Aggiornato", description: "Le note sull'inquilino sono state salvate." });
    },
    onError: () => {
      toast({ title: "Errore", variant: "destructive" });
    }
  });

  return {
    tenants,
    isLoading,
    updateProfile
  };
};