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
  stato: 'da_pagare' | 'pagato' | 'pre_autorizzato' | 'rilasciato' | 'scaduto' | 'annullato';
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
      action: 'release' | 'capture_full' | 'capture_partial';
      capture_amount?: number;
      reason?: string;
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
        capture_full: 'Cauzione trattenuta',
        capture_partial: 'Cauzione trattenuta parzialmente'
      };
      toast({ title: actionLabel[variables.action] });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};

export const useAddTenantPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      booking_id: string;
      tipo: string;
      importo: number;
      data_scadenza: string;
      is_preauth: boolean;
      description?: string;
      notes?: string;
      generate_stripe?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Inserisci il pagamento in tenant_payments
      const { data: payment, error: insertError } = await supabase
        .from('tenant_payments')
        .insert({
          booking_id: params.booking_id,
          tipo: params.tipo,
          importo: params.importo,
          data_scadenza: params.data_scadenza,
          stato: 'da_pagare',
          is_preauth: params.is_preauth,
          description: params.description || null,
          notes: params.notes || null,
          category: params.is_preauth ? 'deposito_cauzionale' : 'extra',
          user_id: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Se richiesto, genera il checkout Stripe
      if (params.generate_stripe) {
        const { error: stripeError } = await supabase.functions.invoke('stripe-create-checkout', {
          body: { payment_id: payment.id }
        });
        if (stripeError) throw new Error(`Pagamento creato ma link Stripe fallito: ${stripeError.message}`);
      }

      return payment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-payments', variables.booking_id] });
      toast({ title: '✅ Pagamento aggiunto', description: variables.generate_stripe ? 'Link Stripe generato e pronto per l\'ospite.' : 'Pagamento salvato senza link Stripe.' });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};

export const useDeleteTenantPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { payment_id: string; booking_id: string }) => {
      const { error } = await supabase
        .from('tenant_payments')
        .delete()
        .eq('id', params.payment_id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-payments', variables.booking_id] });
      toast({ title: 'Pagamento eliminato' });
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
