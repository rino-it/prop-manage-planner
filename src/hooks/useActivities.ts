import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Definiamo il tipo esteso per le attività con i preventivi
export interface Activity {
  id: string;
  nome: string; // Titolo ticket
  descrizione?: string;
  tipo: 'manutenzione' | 'pulizia' | 'ispezione' | 'generale';
  priorita: 'alta' | 'media' | 'bassa';
  stato: 'aperto' | 'in_corso' | 'completato' | 'in_attesa';
  
  // Nuovi Campi Fase 2
  property_real_id?: string | null;
  booking_id?: string | null; // Link all'inquilino
  quote_url?: string | null;
  quote_amount?: number | null;
  quote_status?: 'none' | 'pending' | 'approved' | 'rejected';
  
  created_at: string;
  properties_real?: { nome: string };
  bookings?: { nome_ospite: string };
}

export const useActivities = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. FETCH ATTIVITÀ / TICKET
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          properties_real (nome),
          bookings (nome_ospite)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Activity[];
    },
  });

  // 2. CREA TICKET (Con controlli orfani)
  const createActivity = useMutation({
    mutationFn: async (newTicket: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('activities')
        .insert({
            ...newTicket,
            user_id: user?.id,
            stato: 'aperto',
            quote_status: 'none' // Default
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities-tickets'] });
      toast({ title: "Ticket Aperto", description: "La richiesta è stata registrata." });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  // 3. AGGIORNA / CARICA PREVENTIVO
  const updateActivity = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('activities')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities-tickets'] });
      toast({ title: "Aggiornato", description: "Ticket modificato con successo." });
    }
  });

  // 4. APPROVAZIONE PREVENTIVO (Workflow)
  const handleQuoteDecision = useMutation({
    mutationFn: async ({ id, decision }: { id: string, decision: 'approved' | 'rejected' }) => {
       const { error } = await supabase
        .from('activities')
        .update({ 
            quote_status: decision,
            stato: decision === 'approved' ? 'in_corso' : 'in_attesa' 
        })
        .eq('id', id);
       if (error) throw error;
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['activities-tickets'] });
        const msg = variables.decision === 'approved' ? "Spesa approvata! Procedere." : "Preventivo rifiutato.";
        toast({ title: "Decisione Registrata", description: msg, variant: variables.decision === 'approved' ? "default" : "destructive" });
    }
  });

  // 5. DELETE
  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
       await supabase.from('activities').delete().eq('id', id);
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['activities-tickets'] });
       toast({ title: "Ticket eliminato" });
    }
  });

  return {
    activities,
    isLoading,
    createActivity,
    updateActivity,
    handleQuoteDecision,
    deleteActivity
  };
};