import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Activity {
  id: string;
  nome: string;
  descrizione?: string;
  tipo: 'manutenzione' | 'pulizia' | 'ispezione' | 'generale';
  priorita: 'alta' | 'media' | 'bassa';
  stato: 'aperto' | 'in_corso' | 'completato' | 'in_attesa';
  
  // Campi Esistenti (Quote & Link)
  property_real_id?: string | null;
  booking_id?: string | null;
  quote_url?: string | null;
  quote_amount?: number | null;
  quote_status?: 'none' | 'pending' | 'approved' | 'rejected';
  
  // Nuovo Campo (Step 7)
  assigned_to?: string[]; // Array di UUID
  
  created_at: string;
  properties_real?: { nome: string };
  bookings?: { nome_ospite: string };
}

export const useActivities = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. FETCH ATTIVITÀ (Inclusi dati preventivi e inquilini)
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

  // 2. FETCH TEAM (NUOVO: Per il componente MultiSelect)
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email');
      return data?.map(u => ({
        id: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Utente'
      })) || [];
    }
  });

  // 3. CREA ATTIVITÀ (Aggiornato con assigned_to)
  const createActivity = useMutation({
    mutationFn: async (newTicket: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('activities')
        .insert({
            ...newTicket,
            user_id: user?.id, // Creatore
            assigned_to: newTicket.assigned_to || [], // <--- Salva l'array di assegnatari
            stato: 'aperto',
            quote_status: 'none'
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities-tickets'] });
      toast({ title: "Ticket Aperto", description: "La richiesta è stata registrata." });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  // 4. AGGIORNA ATTIVITÀ (Ripristinato)
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

  // 5. GESTIONE PREVENTIVI (Ripristinato)
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

  // 6. DELETE (Ripristinato)
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
    teamMembers, // Export per la UI
    isLoading,
    createActivity,
    updateActivity,
    handleQuoteDecision,
    deleteActivity
  };
};