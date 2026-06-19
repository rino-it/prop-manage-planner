import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { derivePianoStats, generateRate, type RataInput, type Frequenza } from '@/utils/rientri';

export interface PianoInput {
  gestione_id: string; fornitore: string; direzione: 'uscita' | 'entrata';
  importo_totale: number; numero_rate: number; frequenza: Frequenza;
  data_prima_rata: string; note?: string | null;
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  ['piani-rientro', 'payments', 'upcoming-payments', 'payment-stats', 'unified-expenses', 'cassa']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
};

export function usePianiRientro() {
  return useQuery({
    queryKey: ['piani-rientro'],
    queryFn: async () => {
      const { data: piani, error } = await supabase
        .from('piani_rientro').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (piani || []).map(p => p.id);
      let rate: any[] = [];
      let consolidate: any[] = [];
      if (ids.length) {
        const { data: r } = await supabase.from('payments').select('*').in('piano_rientro_id', ids);
        const { data: c } = await supabase.from('payments').select('*').in('consolidato_in_piano_id', ids);
        rate = r || []; consolidate = c || [];
      }
      return (piani || []).map(p => {
        const pr = rate.filter(x => x.piano_rientro_id === p.id)
          .sort((a, b) => (a.rata_numero ?? 0) - (b.rata_numero ?? 0));
        return {
          ...p,
          rate: pr,
          consolidate: consolidate.filter(x => x.consolidato_in_piano_id === p.id),
          stats: derivePianoStats(pr, Number(p.importo_totale)),
        };
      });
    },
  });
}

function rateToPayments(piano: PianoInput, pianoId: string, rate: RataInput[], userId: string, total = rate.length, offset = 0) {
  return rate.map((r, i) => ({
    user_id: userId,
    gestione_id: piano.gestione_id,
    descrizione: `Rata ${offset + i + 1}/${total} — ${piano.fornitore}`,
    importo: r.importo,
    scadenza: r.scadenza,
    fornitore: piano.fornitore,
    categoria: 'altro',
    stato: 'in_attesa',
    ricorrenza_tipo: 'una_tantum',
    is_advance: piano.direzione === 'entrata',
    debtor_name: piano.direzione === 'entrata' ? piano.fornitore : null,
    piano_rientro_id: pianoId,
    rata_numero: offset + i + 1,
  }));
}

export function useCreatePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ piano, rate, consolidaIds }: { piano: PianoInput; rate: RataInput[]; consolidaIds?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from('piani_rientro').insert({ ...piano, user_id: user!.id }).select().single();
      if (error) throw error;
      const rows = rateToPayments(piano, created.id, rate, user!.id);
      const { error: e2 } = await supabase.from('payments').insert(rows);
      if (e2) throw e2;
      if (consolidaIds?.length) {
        const { error: e3 } = await supabase.from('payments')
          .update({ consolidato_in_piano_id: created.id }).in('id', consolidaIds);
        if (e3) throw e3;
      }
      return created;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, piano, rateEsistenti }: { id: string; piano: PianoInput; rateEsistenti: any[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const pagate = rateEsistenti.filter(r => r.stato === 'pagato' || r.stato === 'rimborsato');
      const nonPagateIds = rateEsistenti
        .filter(r => !(r.stato === 'pagato' || r.stato === 'rimborsato')).map(r => r.id);
      const { error: eU } = await supabase.from('piani_rientro')
        .update({ ...piano, updated_at: new Date().toISOString() }).eq('id', id);
      if (eU) throw eU;
      if (nonPagateIds.length) {
        const { error } = await supabase.from('payments').delete().in('id', nonPagateIds);
        if (error) throw error;
      }
      const importoPagato = pagate.reduce((s, r) => s + Number(r.importo), 0);
      const residuo = Math.round((piano.importo_totale - importoPagato) * 100) / 100;
      const nDaGenerare = piano.numero_rate - pagate.length;
      if (residuo > 0 && nDaGenerare > 0) {
        const nuove = generateRate({
          importoTotale: residuo, numeroRate: nDaGenerare,
          frequenza: piano.frequenza, dataPrimaRata: piano.data_prima_rata,
        });
        const rows = rateToPayments(piano, id, nuove, user!.id, piano.numero_rate, pagate.length);
        const { error } = await supabase.from('payments').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // elimina rate non pagate
      await supabase.from('payments').delete()
        .eq('piano_rientro_id', id).in('stato', ['in_attesa', 'scaduto']);
      // scollega rate pagate e originali consolidate (restano per storico)
      await supabase.from('payments').update({ piano_rientro_id: null }).eq('piano_rientro_id', id);
      await supabase.from('payments').update({ consolidato_in_piano_id: null }).eq('consolidato_in_piano_id', id);
      const { error } = await supabase.from('piani_rientro').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
