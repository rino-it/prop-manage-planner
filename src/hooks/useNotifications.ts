import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Notification = Tables<'notifications'>;
type NotificationInsert = TablesInsert<'notifications'>;

export const useNotifications = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          properties_real:property_real_id(nome, codice_identificativo),
          properties_mobile:property_mobile_id(nome, codice_identificativo)
        `)
        .order('data_scadenza', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le notifiche",
          variant: "destructive",
        });
      },
    },
  });
};

export const useUpcomingNotifications = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['upcoming-notifications'],
    queryFn: async () => {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          properties_real:property_real_id(nome, codice_identificativo),
          properties_mobile:property_mobile_id(nome, codice_identificativo)
        `)
        .lte('data_scadenza', thirtyDaysFromNow.toISOString().split('T')[0])
        .eq('inviata', false)
        .order('data_scadenza', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le notifiche imminenti",
          variant: "destructive",
        });
      },
    },
  });
};

export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (notification: NotificationInsert) => {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-notifications'] });
      toast({
        title: "Notifica creata",
        description: "La notifica è stata creata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare la notifica",
        variant: "destructive",
      });
    },
  });
};

export const useMarkNotificationSent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          inviata: true, 
          data_invio: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-notifications'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la notifica",
        variant: "destructive",
      });
    },
  });
};