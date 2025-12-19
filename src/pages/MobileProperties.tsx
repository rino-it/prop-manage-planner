import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function MobileProperties() {
  
  // FETCH "NUDA E CRUDA" PER VEDERE L'ERRORE REALE
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['mobile_properties_debug'],
    queryFn: async () => {
      console.log("DEBUG: Inizio richiesta Supabase...");
      
      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*'); // Seleziona tutto senza filtri complessi

      if (error) {
        console.error("DEBUG: Errore Supabase rilevato:", error);
        throw error;
      }
      
      console.log("DEBUG: Dati ricevuti:", data);
      return data || [];
    },
    retry: 0 // Non riprovare, voglio vedere subito l'errore
  });

  // 1. GESTIONE CARICAMENTO
  if (isLoading) {
    return <div className="p-10 text-xl text-blue-600 font-bold animate-pulse">Caricamento dati in corso...</div>;
  }

  // 2. GESTIONE ERRORE (IL TUO OBIETTIVO)
  if (error) {
    return (
      <div className="p-10 m-4 bg-red-50 border-2 border-red-500 rounded-lg shadow-xl text-red-900">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-10 h-10 text-red-600" />
          <h1 className="text-2xl font-black uppercase">Errore Rilevato</h1>
        </div>
        
        <div className="font-mono bg-black text-green-400 p-4 rounded mb-6 overflow-auto">
          <p className="font-bold border-b border-gray-600 pb-2 mb-2">DETTAGLIO TECNICO:</p>
          {JSON.stringify(error, null, 2)}
        </div>

        <p className="mb-4 text-lg">
          Messaggio Semplice: <strong>{(error as any).message}</strong><br/>
          Codice: <strong>{(error as any).code || 'N/A'}</strong>
        </p>

        <Button onClick={() => refetch()} size="lg" className="bg-red-600 hover:bg-red-700 text-white w-full">
          <RefreshCw className="mr-2"/> RIPROVA CONNESSIONE
        </Button>
      </div>
    );
  }

  // 3. SE FUNZIONA: MOSTRA I DATI GREZZI
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-green-700">✅ CONNESSIONE RIUSCITA</h1>
      <p className="text-gray-600">Se vedi questo, il collegamento Database è attivo.</p>
      
      <div className="bg-slate-100 p-4 rounded border font-mono text-sm">
        {data && data.length === 0 ? (
          <p className="text-gray-500">La tabella è vuota (Nessun veicolo trovato).</p>
        ) : (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>

      <Button className="mt-4" onClick={() => window.location.reload()}>Ricarica Pagina</Button>
    </div>
  );
}