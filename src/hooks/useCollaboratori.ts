import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { hasCollaboratori } from '@/lib/dbFeatures';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Collaboratore = Tables<'collaboratori'>;
export type Condizione = Tables<'collaboratori_condizioni'> & {
  properties_real?: { nome: string } | null;
};
export interface Compenso {
  id: string;
  importo: number;
  stato: string | null;
  scadenza: string;
  data_pagamento: string | null;
  descrizione: string;
  collaboratore_id: string | null;
  properties_real?: { nome: string } | null;
}

// Modulo Collaboratori: tutte le query passano dal probe hasCollaboratori()
// (migrazione manuale 20260724_collaboratori.sql) e degradano con grazia
// finché la migrazione non è stata eseguita.
export function useCollaboratori() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ready } = useQuery({
    queryKey: ['collaboratori-ready'],
    queryFn: () => hasCollaboratori(),
    staleTime: Infinity,
  });

  const { data: collaboratori = [], isLoading: loadingCollaboratori } = useQuery({
    queryKey: ['collaboratori'],
    enabled: ready === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaboratori')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Collaboratore[];
    },
  });

  const { data: condizioni = [], isLoading: loadingCondizioni } = useQuery({
    queryKey: ['collaboratori-condizioni'],
    enabled: ready === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaboratori_condizioni')
        .select('*, properties_real(nome)')
        .order('created_at');
      if (error) throw error;
      return (data || []) as Condizione[];
    },
  });

  const { data: compensi = [], isLoading: loadingCompensi } = useQuery({
    queryKey: ['collaboratori-compensi'],
    enabled: ready === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, importo, stato, scadenza, data_pagamento, descrizione, collaboratore_id, properties_real(nome)')
        .not('collaboratore_id', 'is', null)
        .order('scadenza', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Compenso[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['collaboratori'] });
    queryClient.invalidateQueries({ queryKey: ['collaboratori-condizioni'] });
    queryClient.invalidateQueries({ queryKey: ['collaboratori-compensi'] });
    queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
  };

  const addCollaboratore = useMutation({
    mutationFn: async (input: Pick<TablesInsert<'collaboratori'>, 'nome' | 'telefono' | 'note'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('collaboratori')
        .insert({ ...input, user_id: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Collaboratore aggiunto' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiungere il collaboratore', variant: 'destructive' });
    },
  });

  const updateCollaboratore = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'collaboratori'> & { id: string }) => {
      const { error } = await supabase.from('collaboratori').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Collaboratore aggiornato' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiornare il collaboratore', variant: 'destructive' });
    },
  });

  const addCondizione = useMutation({
    mutationFn: async (input: Pick<TablesInsert<'collaboratori_condizioni'>, 'collaboratore_id' | 'property_id' | 'tipo' | 'importo'>) => {
      const { error } = await supabase.from('collaboratori_condizioni').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Condizione aggiunta' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiungere la condizione', variant: 'destructive' });
    },
  });

  const toggleCondizione = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from('collaboratori_condizioni').update({ attivo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiornare la condizione', variant: 'destructive' });
    },
  });

  // Compensi mensili: generati lazy all'apertura della pagina. Per ogni
  // condizione 'mensile' attiva senza voce del mese corrente si crea la spesa
  // da_pagare con scadenza 1° del mese. Idempotente per descrizione + mese
  // (descrizione deterministica "Compenso <nome> — mensile <yyyy-MM>").
  const ensureMensili = useMutation({
    mutationFn: async () => {
      if (!(await hasCollaboratori())) return 0;
      const meseCorrente = format(new Date(), 'yyyy-MM');
      const { data: mensili, error } = await supabase
        .from('collaboratori_condizioni')
        .select('id, collaboratore_id, importo, attivo, tipo, collaboratori(nome, attivo)')
        .eq('tipo', 'mensile')
        .eq('attivo', true);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      let creati = 0;
      for (const cond of mensili || []) {
        const col = cond.collaboratori as unknown as { nome: string; attivo: boolean } | null;
        if (!col?.attivo) continue;
        const descrizione = `Compenso ${col.nome} — mensile ${meseCorrente}`;
        const { data: esistenti, error: errCheck } = await supabase
          .from('payments')
          .select('id')
          .eq('collaboratore_id', cond.collaboratore_id)
          .eq('descrizione', descrizione)
          .limit(1);
        if (errCheck) throw errCheck;
        if (esistenti && esistenti.length > 0) continue;

        const { error: errInsert } = await supabase.from('payments').insert({
          importo: Number(cond.importo),
          importo_originale: Number(cond.importo),
          descrizione,
          categoria: 'altro',
          scadenza: `${meseCorrente}-01`,
          stato: 'da_pagare',
          competence: 'owner',
          payment_method: 'contanti',
          user_id: user.id,
          collaboratore_id: cond.collaboratore_id,
        });
        if (errInsert) throw errInsert;
        creati += 1;
      }
      return creati;
    },
    onSuccess: (creati) => {
      if (creati > 0) invalidateAll();
    },
  });

  return {
    collaboratori,
    condizioni,
    compensi,
    isLoading: ready === undefined || loadingCollaboratori || loadingCondizioni || loadingCompensi,
    ready: ready === true,
    addCollaboratore,
    updateCollaboratore,
    addCondizione,
    toggleCondizione,
    ensureMensili,
  };
}
