import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { buildPaymentRows } from '@/utils/incassi';
import { hasIncassiLiberi } from '@/lib/dbFeatures';

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
      const free = await hasIncassiLiberi();
      const { data, error } = await supabase
        .from('tenant_payments')
        .select(`
          *,
          ${free ? 'properties_real (nome, gestione_id),' : ''}
          bookings (
            nome_ospite,
            property_id,
            properties_real (nome, gestione_id)
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
        property_id?: string,
        amount: number,
        date_start: Date,
        months: number,
        category: string,
        description: string,
        is_recurring: boolean,
        already_paid?: boolean,
        payment_method?: string,
        conto_id?: string,
    }) => {
      const { booking_id, property_id, amount, date_start, months, category, description,
              is_recurring, already_paid, payment_method, conto_id } = params;

      // RECUPERO UTENTE SICURO
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utente non loggato. Ricarica la pagina.");
      }

      if (!booking_id && !(await hasIncassiLiberi())) {
        throw new Error("Per gli incassi senza inquilino serve la migrazione del database (colonna property_id): esegui la SQL in supabase/migrations/20260720_tenant_payments_property_id.sql.");
      }

      const groupId = is_recurring ? crypto.randomUUID() : null;
      const rows = buildPaymentRows(
        { booking_id, property_id, amount, date_start, months, category, description,
          is_recurring, already_paid, payment_method, conto_id },
        user.id,
        groupId,
      );

      const { error } = await supabase.from('tenant_payments').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      const paid = variables.already_paid && !variables.is_recurring;
      toast({
        title: paid ? 'Incasso registrato' : 'Piano Registrato',
        description: paid ? 'Registrato in cassa.' : 'Le scadenze sono state generate.',
      });
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

  // 5. CONFERMA INCASSO (con data e metodo pagamento)
  const confirmPayment = useMutation({
    mutationFn: async ({ id, paymentDate, paymentType, contoId }: { id: string; paymentDate: string; paymentType: string; contoId?: string }) => {
      const { error } = await supabase
        .from('tenant_payments')
        .update({
          stato: 'pagato',
          payment_date: new Date(paymentDate).toISOString(),
          payment_type: paymentType,
          conto_id: contoId || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      toast({ title: '✅ Incasso confermato', description: 'Registrato in cassa.' });
    },
    onError: (err: any) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
  });

  // 6. AGGIORNA
  const updatePayment = useMutation({
    mutationFn: async ({ id, importo, data_scadenza, category, description }: {
      id: string; importo: number; data_scadenza: string; category: string; description: string;
    }) => {
      const { error } = await supabase
        .from('tenant_payments')
        .update({ importo, data_scadenza, category, description })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      toast({ title: 'Aggiornato' });
    },
    onError: (err: any) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
  });

  // 7. CAMBIA CONTO (incasso già registrato)
  const changeConto = useMutation({
    mutationFn: async ({ id, contoId }: { id: string; contoId: string | null }) => {
      const { error } = await supabase
        .from('tenant_payments')
        .update({ conto_id: contoId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cassa'] });
      queryClient.invalidateQueries({ queryKey: ['movimenti-senza-conto'] });
      toast({ title: 'Conto aggiornato', description: 'Il movimento è stato spostato sul nuovo conto.' });
    },
    onError: (err: any) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
  });

  return {
    revenues,
    isLoading,
    createPaymentPlan,
    markAsPaid,
    confirmPayment,
    updatePayment,
    deletePayment,
    changeConto
  };
};