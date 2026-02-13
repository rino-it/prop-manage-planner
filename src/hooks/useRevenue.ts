import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addMonths, format } from 'date-fns';

export interface PaymentEntry {
  id: string;
  booking_id: string;
  importo: number;
  category: 'canone_locazione' | 'rimborso_utenze' | 'deposito_cauzionale' | 'extra';
  data_scadenza: string;
  payment_date?: string | null;
  stato: 'da_pagare' | 'pagato' | 'scaduto' | 'annullato';
  notes: string;
  is_recurring?: boolean;
  recurrence_group_id?: string;
  bookings?: {
    nome_ospite: string;
    properties_real?: {
        nome: string;
    }
  };
}

export const useRevenue = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. OTTIENI TUTTI I PAGAMENTI
  const { data: revenues, isLoading } = useQuery({
    queryKey: ['revenue-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payments')
        .select(`
          *,
          bookings (
            nome_ospite,
            properties_real (nome)
          )
        `)
        .order('data_scadenza', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // 2. CREA PIANO RATEALE (Con Fix User ID)
  const createPaymentPlan = useMutation({
    mutationFn: async (params: { 
        booking_id: string, 
        amount: number, 
        date_start: Date, 
        months: number, 
        category: string, 
        description: string, 
        is_recurring: boolean 
    }) => {
      const { booking_id, amount, date_start, months, category, description, is_recurring } = params;
      
      // RECUPERO UTENTE SICURO
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utente non loggato. Ricarica la pagina.");
      }
      
      const paymentsToInsert = [];
      const groupId = is_recurring ? crypto.randomUUID() : null;

      const iterations = is_recurring ? months : 1;

      for (let i = 0; i < iterations; i++) {
        const dueDate = addMonths(date_start, i);
        
        const noteText = is_recurring 
            ? `${description} (Rata ${i+1}/${months})` 
            : description;

        paymentsToInsert.push({
            booking_id,
            importo: amount,
            data_scadenza: format(dueDate, 'yyyy-MM-dd'),
            category,
            notes: noteText,
            stato: 'da_pagare',
            is_recurring,
            recurrence_group_id: groupId,
            user_id: user.id // <--- QUESTO È IL PUNTO CRITICO CHE MANCAVA O ERA NULL
        });
      }

      const { error } = await supabase.from('tenant_payments').insert(paymentsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      toast({ title: "Piano Registrato", description: "Le scadenze sono state generate." });
    },
    onError: (error: any) => toast({ title: "Errore", description: error.message, variant: "destructive" })
  });

  // 3. SEGNA COME INCASSATO
  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenant_payments')
        .update({ 
            stato: 'pagato', 
            payment_date: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      toast({ title: "Incasso Confermato", description: "Soldi registrati in cassa." });
    }
  });

  // 4. ELIMINA
  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenant_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      toast({ title: "Eliminato" });
    }
  });

  return {
    revenues,
    isLoading,
    createPaymentPlan,
    markAsPaid,
    deletePayment
  };
};