import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentSettings {
  id: string;
  property_id: string;
  user_id: string | null;
  stripe_account_id: string | null;
  stripe_configured: boolean;
  caparra_percentage: number;
  caparra_due_days: number;
  saldo_due_days_before: number;
  cauzione_amount: number;
  cauzione_preauth_days_before: number;
  cauzione_release_days_after: number;
  tassa_soggiorno_per_night: number;
  tassa_soggiorno_per_person: boolean;
  checkin_email_days_before: number;
  reminder_days_before: number;
  brand_logo_url: string | null;
  brand_color: string;
  email_from_name: string | null;
  email_reply_to: string | null;
  ical_url: string | null;
  created_at: string;
  updated_at: string;
}

export const usePaymentSettings = (propertyId: string | undefined) => {
  return useQuery({
    queryKey: ['payment-settings', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();
      if (error) throw error;
      return data as PaymentSettings | null;
    },
    enabled: !!propertyId
  });
};

export const useSavePaymentSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<PaymentSettings> & { property_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { error } = await supabase
        .from('payment_settings')
        .upsert(
          {
            ...settings,
            user_id: user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'property_id' }
        );
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings', variables.property_id] });
      toast({ title: 'Configurazione salvata' });
    },
    onError: (err: Error) => toast({ title: 'Errore', description: err.message, variant: 'destructive' })
  });
};
