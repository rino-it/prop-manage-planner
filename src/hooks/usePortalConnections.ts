import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PortalConnection {
  id: string;
  user_id: string;
  property_id: string;
  portal_name: string;
  connection_type: string;
  ical_url: string | null;
  api_credentials: Record<string, unknown> | null;
  status: string;
  last_sync: string | null;
  last_sync_result: {
    events_imported?: number;
    events_skipped?: number;
    errors?: string[] | null;
    synced_at?: string;
  } | null;
  created_at: string;
  updated_at: string;
  properties_real?: { id: string; nome: string } | null;
}

export interface CreateConnectionPayload {
  property_id: string;
  portal_name: string;
  connection_type: string;
  ical_url?: string;
}

export function usePortalConnections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: ['portal-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_connections')
        .select('*, properties_real(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PortalConnection[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const createConnection = useMutation({
    mutationFn: async (payload: CreateConnectionPayload) => {
      const { data, error } = await supabase
        .from('portal_connections')
        .insert({
          user_id: user!.id,
          property_id: payload.property_id,
          portal_name: payload.portal_name,
          connection_type: payload.connection_type,
          ical_url: payload.ical_url || null,
          status: 'active',
        })
        .select('*, properties_real(id, nome)')
        .single();
      if (error) throw error;
      return data as PortalConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortalConnection> & { id: string }) => {
      const { data, error } = await supabase
        .from('portal_connections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, properties_real(id, nome)')
        .single();
      if (error) throw error;
      return data as PortalConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portal_connections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
    },
  });

  const syncConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke('sync-portals', {
        body: { connection_id: connectionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-blocked'] });
    },
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-portals', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-connections'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['portal-calendar-blocked'] });
    },
  });

  return {
    connections: connectionsQuery.data || [],
    isLoading: connectionsQuery.isLoading,
    error: connectionsQuery.error,
    createConnection,
    updateConnection,
    deleteConnection,
    syncConnection,
    syncAll,
  };
}
