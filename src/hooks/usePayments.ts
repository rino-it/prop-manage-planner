import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Payment = Tables<'payments'>;
type PaymentInsert = TablesInsert<'payments'>;

export const usePayments = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          properties_real(nome),
          properties_mobile(nome)
        `)
        .order('scadenza', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare i pagamenti",
          variant: "destructive",
        });
      },
    },
  });
};

export const useUpcomingPayments = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['upcoming-payments'],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          properties_real(nome),
          properties_mobile(nome)
        `)
        .gte('scadenza', new Date().toISOString())
        .lte('scadenza', thirtyDaysFromNow.toISOString())
        .eq('stato', 'in_attesa')
        .order('scadenza', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare i pagamenti in scadenza",
          variant: "destructive",
        });
      },
    },
  });
};

export const usePaymentStats = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const endOfYear = new Date(new Date().getFullYear(), 11, 31);
      
      const { data, error } = await supabase
        .from('payments')
        .select('importo, scadenza, stato')
        .gte('scadenza', startOfYear.toISOString())
        .lte('scadenza', endOfYear.toISOString());
      
      if (error) throw error;
      
      const totalAmount = data.reduce((sum, payment) => sum + Number(payment.importo), 0);
      const paidAmount = data
        .filter(p => p.stato === 'pagato')
        .reduce((sum, payment) => sum + Number(payment.importo), 0);
      const overdueCount = data.filter(p => 
        p.stato === 'scaduto' || 
        (p.stato === 'in_attesa' && new Date(p.scadenza) < new Date())
      ).length;
      
      return {
        totalAmount,
        paidAmount,
        overdueCount,
        totalCount: data.length
      };
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le statistiche dei pagamenti",
          variant: "destructive",
        });
      },
    },
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (payment: PaymentInsert) => {
      const { data, error } = await supabase
        .from('payments')
        .insert(payment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      toast({
        title: "Pagamento aggiunto",
        description: "Il pagamento è stato aggiunto con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il pagamento",
        variant: "destructive",
      });
    },
  });
};