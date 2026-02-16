import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface AdminNotification {
  id: string;
  user_id: string;
  tipo: string;
  titolo: string;
  messaggio: string;
  data_scadenza: string;
  priorita: 'bassa' | 'media' | 'alta' | 'critica';
  inviata: boolean;
  data_invio: string | null;
  created_at: string;
  booking_id?: string | null;
  ticket_id?: string | null;
  property_real_id?: string | null;
  property_mobile_id?: string | null;
}

export const useAdminNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Fetch unread notifications
  const { data: notifications = [], isLoading, error } = useQuery<AdminNotification[]>({
    queryKey: ['admin-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('inviata', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdminNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Fallback polling every 30s if WebSocket fails
  });

  // Setup Realtime WebSocket subscription
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
          console.log('📬 New notification received:', payload.new);

          const newNotification = payload.new as AdminNotification;

          // Play sound for high-priority notifications
          if (['critica', 'alta'].includes(newNotification.priorita)) {
            playNotificationSound();
          }

          // Optimistically update cache (instant UI update)
          queryClient.setQueryData<AdminNotification[]>(
            ['admin-notifications', user.id],
            (old = []) => [newNotification, ...old]
          );

          // Browser notification (if permission granted)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.titolo, {
              body: newNotification.messaggio,
              icon: '/logo.png',
              tag: newNotification.id,
              requireInteraction: newNotification.priorita === 'critica',
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
          console.log('🔄 Notification updated:', payload.new);

          // Update cache
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
        console.log('WebSocket status:', status);

        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime error:', err);

          if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY_BASE * Math.pow(2, connectionAttempts);
            console.log(`Reconnecting in ${delay}ms (attempt ${connectionAttempts + 1})`);

            setTimeout(() => {
              setConnectionAttempts((prev) => prev + 1);
              notificationChannel.subscribe();
            }, delay);
          } else {
            toast({
              title: 'Notifiche in modalità offline',
              description: 'Le notifiche saranno aggiornate ogni 30 secondi',
            });
          }
        } else if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected');
          setConnectionAttempts(0); // Reset on successful connection
        }
      });

    setChannel(notificationChannel);

    return () => {
      console.log('Unsubscribing from notifications channel');
      notificationChannel.unsubscribe();
    };
  }, [user, queryClient, connectionAttempts, toast]);

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ inviata: true, data_invio: new Date().toISOString() })
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

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ inviata: true, data_invio: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('inviata', false);

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

// Helper: Play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch((err) => console.warn('Audio play failed:', err));
  } catch (err) {
    console.warn('Audio not supported:', err);
  }
}
