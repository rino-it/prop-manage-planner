import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TenantPayment {
  id: string;
  booking_id: string;
  importo: number;
  category: string;
  data_scadenza: string;
  payment_date: string | null;
  stato: 'da_pagare' | 'pagato' | 'scaduto' | 'annullato';
  notes: string;
  is_preauth: boolean;
  stripe_checkout_url: string | null;
  stripe_payment_intent_id: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  booking_id: string;
  email_type: string;
  recipient: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
}

export const useBookingPayments = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ['booking-payments', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('data_scadenza', { ascending: true });
      if (error) throw error;
      return data as TenantPayment[];
    },
    enabled: !!bookingId,
    refetchInterval: 30000
  });
};

export const useGeneratePaymentSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      booking_id: string;
      property_id: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-payment-schedule', {
        body: params
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-payments', variables.booking_id] });
      toast({ title: 'Calendario pagamenti generato' });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};

export const useRegenerateCheckout = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      payment_id: string;
      booking_id: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: params
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-payments', variables.booking_id] });
      toast({ title: 'Checkout rigenerato' });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};

export const useManagePreauth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      payment_id: string;
      booking_id: string;
      action: 'release' | 'capture' | 'capture_partial';
      capture_amount?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-manage-preauth', {
        body: params
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-payments', variables.booking_id] });
      const actionLabel = {
        release: 'Cauzione rilasciata',
        capture: 'Cauzione trattenuta',
        capture_partial: 'Cauzione trattenuta parzialmente'
      };
      toast({ title: actionLabel[variables.action] });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};

export const useEmailLog = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ['email-log', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('email_log')
        .select('*')
        .eq('booking_id', bookingId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!bookingId
  });
};

export const useSendEmail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      booking_id: string;
      email_type: string;
      recipient: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: params
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-log', variables.booking_id] });
      toast({ title: 'Email inviata con successo' });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};
