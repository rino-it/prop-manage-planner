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
  // 1. Scarica i dati necessari per l'analisi
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

  // 2. Motore di Regole (L'Algoritmo)
  const suggestions: Suggestion[] = [];

  // REGOLA A: Ticket Ricorrenti (Se > 2 ticket simili sullo stesso immobile)
  // (Semplificazione per MVP: se un immobile ha > 2 ticket aperti/lavorazione)
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

  // REGOLA B: Scadenza Contratti (Avviso 60 giorni prima)
  properties?.forEach(p => {
    if (p.data_fine_contratto) {
      const daysLeft = differenceInDays(new Date(p.data_fine_contratto), new Date());
      if (daysLeft > 0 && daysLeft < 60) {
        suggestions.push({
          id: `contract-${p.id}`,
          title: 'Rinnovo Contratto in Scadenza',
          description: `Il contratto per ${p.nome} scade tra ${daysLeft} giorni. Contattare l'inquilino.`,
          priority: daysLeft < 30 ? 'alta' : 'media',
          type: 'amministrativa',
          property_name: p.nome,
          estimated_cost: 0
        });
      }
    }
  });

  // REGOLA C: Manutenzione Caldaia (Esempio statico stagionale - Ottobre)
  const currentMonth = new Date().getMonth();
  if (currentMonth === 9) { // Ottobre
    suggestions.push({
      id: 'seasonal-boiler',
      title: 'Controllo Caldaie Invernale',
      description: 'Ottobre è il mese ideale per la manutenzione ordinaria delle caldaie.',
      priority: 'media',
      type: 'manutenzione',
      property_name: 'Tutte le proprietà',
      estimated_cost: 120 * (properties?.length || 1)
    });
  }

  return { suggestions, count: suggestions.length };
};