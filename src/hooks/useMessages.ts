import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  booking_id: string | null;
  property_id: string | null;
  sender_type: 'host' | 'guest' | 'system';
  content: string;
  channel: 'whatsapp' | 'email' | 'internal';
  read: boolean;
  template_key: string | null;
  metadata: Record<string, any>;
  user_id: string;
  created_at: string;
  bookings?: {
    nome_ospite: string;
    properties_real: { nome: string } | null;
  } | null;
  properties_real?: { nome: string } | null;
}

export interface NewMessage {
  booking_id?: string | null;
  property_id?: string | null;
  sender_type: 'host' | 'guest' | 'system';
  content: string;
  channel: 'whatsapp' | 'email' | 'internal';
  template_key?: string | null;
  metadata?: Record<string, any>;
}

export const useMessages = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          bookings (
            nome_ospite,
            properties_real (nome)
          ),
          properties_real (nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Message[];
    },
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  const sendMessage = useMutation({
    mutationFn: async (msg: NewMessage) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { error, data } = await supabase
        .from('messages')
        .insert({
          ...msg,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({ title: 'Messaggio inviato' });
    },
    onError: (err: any) => {
      toast({
        title: 'Errore invio messaggio',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({ title: 'Tutti i messaggi segnati come letti' });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({ title: 'Messaggio eliminato' });
    },
    onError: (err: any) => {
      toast({
        title: 'Errore eliminazione',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return {
    messages,
    isLoading,
    unreadCount,
    sendMessage,
    markAsRead,
    markAllAsRead,
    deleteMessage,
  };
};
