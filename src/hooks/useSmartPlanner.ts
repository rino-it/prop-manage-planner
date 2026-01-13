import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, isBefore, differenceInDays } from 'date-fns';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'bassa';
  type: 'manutenzione' | 'amministrativa' | 'finanziaria';
  property_name: string;
  estimated_cost: number;
}

export const useSmartPlanner = () => {
  // 1. Scarica i dati
  const { data: tickets } = useQuery({
    queryKey: ['tickets-analysis'],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*, properties_real(nome)');
      return data || [];
    }
  });

  const { data: properties } = useQuery({
    queryKey: ['properties-analysis'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_real').select('*');
      return data || [];
    }
  });

  // NUOVO: Scarica dati Veicoli
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-analysis'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('*');
      return data || [];
    }
  });

  // 2. Motore di Regole
  const suggestions: Suggestion[] = [];

  // REGOLA A: Ticket Ricorrenti
  const ticketCounts: Record<string, number> = {};
  tickets?.forEach(t => {
    if (t.stato !== 'risolto' && t.property_real_id) {
      ticketCounts[t.property_real_id] = (ticketCounts[t.property_real_id] || 0) + 1;
    }
  });

  Object.keys(ticketCounts).forEach(propId => {
    if (ticketCounts[propId] >= 2) {
      const propName = properties?.find(p => p.id === propId)?.nome || 'Immobile';
      suggestions.push({
        id: `alert-${propId}`,
        title: 'Intervento Strutturale Richiesto',
        description: `Ci sono ${ticketCounts[propId]} ticket aperti su ${propName}. Consigliamo un controllo generale.`,
        priority: 'alta',
        type: 'manutenzione',
        property_name: propName,
        estimated_cost: 250
      });
    }
  });

  // REGOLA B: Contratti in scadenza
  properties?.forEach(p => {
    if (p.data_fine_contratto) {
      const daysLeft = differenceInDays(new Date(p.data_fine_contratto), new Date());
      if (daysLeft > 0 && daysLeft < 60) {
        suggestions.push({
          id: `contract-${p.id}`,
          title: 'Rinnovo Contratto in Scadenza',
          description: `Il contratto per ${p.nome} scade tra ${daysLeft} giorni.`,
          priority: daysLeft < 30 ? 'alta' : 'media',
          type: 'amministrativa',
          property_name: p.nome,
          estimated_cost: 0
        });
      }
    }
  });

  // REGOLA C: Scadenze Veicoli (NUOVA)
  vehicles?.forEach(v => {
      // Controllo Assicurazione (Avviso 30gg prima)
      if (v.scadenza_assicurazione) {
          const daysToIns = differenceInDays(new Date(v.scadenza_assicurazione), new Date());
          if (daysToIns < 30) {
              suggestions.push({
                  id: `ins-${v.id}`,
                  title: daysToIns < 0 ? 'Assicurazione SCADUTA' : 'Rinnovo Assicurazione',
                  description: daysToIns < 0 ? `Il veicolo ${v.veicolo} circola senza assicurazione!` : `L'assicurazione di ${v.veicolo} scade tra ${daysToIns} giorni.`,
                  priority: 'alta',
                  type: 'amministrativa',
                  property_name: v.veicolo || 'Veicolo',
                  estimated_cost: 500
              });
          }
      }
      // Controllo Revisione
      if (v.data_revisione) {
          const daysToRev = differenceInDays(new Date(v.data_revisione), new Date());
          if (daysToRev < 30) {
              suggestions.push({
                  id: `rev-${v.id}`,
                  title: 'Revisione in Scadenza',
                  description: `Prenotare revisione per ${v.veicolo} (${v.targa}).`,
                  priority: 'media',
                  type: 'manutenzione',
                  property_name: v.veicolo || 'Veicolo',
                  estimated_cost: 80
              });
          }
      }
  });

  return { suggestions, count: suggestions.length };
};