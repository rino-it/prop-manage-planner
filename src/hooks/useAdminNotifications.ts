import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface AdminNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  booking_id?: string | null;
  ticket_id?: string | null;
}

export const useAdminNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const { data: notifications = [], isLoading, error } = useQuery<AdminNotification[]>({
    queryKey: ['admin-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdminNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;

    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY_BASE = 2000;

    const notificationChannel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as AdminNotification;

          if (['error'].includes(newNotification.type)) {
            playNotificationSound();
          }

          queryClient.setQueryData<AdminNotification[]>(
            ['admin-notifications', user.id],
            (old = []) => [newNotification, ...old]
          );

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/logo.png',
              tag: newNotification.id,
              requireInteraction: newNotification.type === 'error',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.setQueryData<AdminNotification[]>(
            ['admin-notifications', user.id],
            (old = []) =>
              old.map((n) =>
                n.id === (payload.new as AdminNotification).id
                  ? (payload.new as AdminNotification)
                  : n
              )
          );
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime error:', err);

          if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY_BASE * Math.pow(2, connectionAttempts);
            setTimeout(() => {
              setConnectionAttempts((prev) => prev + 1);
              notificationChannel.subscribe();
            }, delay);
          } else {
            toast({
              title: 'Notifiche in modalita offline',
              description: 'Le notifiche saranno aggiornate ogni 30 secondi',
            });
          }
        } else if (status === 'SUBSCRIBED') {
          setConnectionAttempts(0);
        }
      });

    setChannel(notificationChannel);

    return () => {
      notificationChannel.unsubscribe();
    };
  }, [user, queryClient, connectionAttempts, toast]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile segnare la notifica come letta',
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile segnare tutte le notifiche come lette',
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    }
  };

  return {
    notifications,
    unreadCount: notifications.length,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    isRealtimeConnected: channel?.state === 'joined',
  };
};

function playNotificationSound() {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch((err) => console.warn('Audio play failed:', err));
  } catch (err) {
    console.warn('Audio not supported:', err);
  }
}
