import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SyncStagingItem {
  id: string;
  sync_batch_id: string;
  connection_id: string;
  property_id: string;
  user_id: string;
  external_uid: string;
  portal_name: string;
  source: string;
  event_type: 'booking' | 'blocked';
  change_type: 'new' | 'updated' | 'cancelled';
  nome_ospite: string | null;
  email_ospite: string | null;
  telefono_ospite: string | null;
  data_inizio: string;
  data_fine: string;
  raw_summary: string | null;
  numero_ospiti: number | null;
  tipo_affitto: string | null;
  existing_booking_id: string | null;
  previous_data: {
    nome_ospite?: string;
    data_inizio?: string;
    data_fine?: string;
  } | null;
  status: string;
  synced_at: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface ConfirmModifications {
  nome_ospite?: string;
  email_ospite?: string;
  telefono_ospite?: string;
  data_inizio?: string;
  data_fine?: string;
  tipo_affitto?: string;
  numero_ospiti?: number;
  codice_fiscale_ospite?: string;
  importo_totale?: number;
}

export function useSyncReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const pendingItemsQuery = useQuery({
    queryKey: ['sync-staging-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_staging')
        .select('*')
        .eq('status', 'pending')
        .order('synced_at', { ascending: true });
      if (error) throw error;
      return (data || []) as SyncStagingItem[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const pendingCountQuery = useQuery({
    queryKey: ['sync-staging-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sync_staging')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sync-staging-pending'] });
    queryClient.invalidateQueries({ queryKey: ['sync-staging-count'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
    queryClient.invalidateQueries({ queryKey: ['portal-calendar-bookings'] });
  };

  const confirmItem = useMutation({
    mutationFn: async ({
      stagingId,
      modifications,
    }: {
      stagingId: string;
      modifications?: ConfirmModifications;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        'confirm-sync-item',
        {
          body: {
            staging_id: stagingId,
            action: 'confirm',
            modifications,
          },
        }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Conferma fallita');
      return data;
    },
    onSuccess: invalidateAll,
  });

  const rejectItem = useMutation({
    mutationFn: async (stagingId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'confirm-sync-item',
        {
          body: {
            staging_id: stagingId,
            action: 'reject',
          },
        }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Rifiuto fallito');
      return data;
    },
    onSuccess: invalidateAll,
  });

  const confirmAllRemaining = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'confirm-sync-item',
        {
          body: {
            batch_id: batchId,
            action: 'confirm_all',
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const rejectAllRemaining = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'confirm-sync-item',
        {
          body: {
            batch_id: batchId,
            action: 'reject_all',
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  return {
    pendingItems: pendingItemsQuery.data || [],
    pendingCount: pendingCountQuery.data || 0,
    isLoading: pendingItemsQuery.isLoading,
    confirmItem,
    rejectItem,
    confirmAllRemaining,
    rejectAllRemaining,
  };
}
