import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Activity = Tables<'activities'>;
type ActivityInsert = TablesInsert<'activities'>;

export const useActivities = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          properties_real(nome),
          properties_mobile(nome)
        `)
        .order('prossima_scadenza', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le attività",
          variant: "destructive",
        });
      },
    },
  });
};

export const useUpcomingActivities = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['upcoming-activities'],
    queryFn: async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          properties_real(nome),
          properties_mobile(nome)
        `)
        .gte('prossima_scadenza', new Date().toISOString())
        .lte('prossima_scadenza', sevenDaysFromNow.toISOString())
        .eq('completata', false)
        .order('prossima_scadenza', { ascending: true })
        .limit(8);
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le attività programmate",
          variant: "destructive",
        });
      },
    },
  });
};

export const useActivityStats = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('completata, priorita, prossima_scadenza');
      
      if (error) throw error;
      
      const totalActivities = data.length;
      const completedActivities = data.filter(a => a.completata).length;
      const urgentActivities = data.filter(a => 
        !a.completata && 
        a.priorita === 'alta' && 
        new Date(a.prossima_scadenza) <= new Date()
      ).length;
      
      return {
        totalActivities,
        completedActivities,
        urgentActivities,
        pendingActivities: totalActivities - completedActivities
      };
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le statistiche delle attività",
          variant: "destructive",
        });
      },
    },
  });
};

export const useCreateActivity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (activity: ActivityInsert) => {
      const { data, error } = await supabase
        .from('activities')
        .insert(activity)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-stats'] });
      toast({
        title: "Attività aggiunta",
        description: "L'attività è stata aggiunta con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere l'attività",
        variant: "destructive",
      });
    },
  });
};

export const useCompleteActivity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (activityId: string) => {
      const { data, error } = await supabase
        .from('activities')
        .update({ 
          completata: true, 
          ultima_esecuzione: new Date().toISOString() 
        })
        .eq('id', activityId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-stats'] });
      toast({
        title: "Attività completata",
        description: "L'attività è stata marcata come completata",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile completare l'attività",
        variant: "destructive",
      });
    },
  });
};