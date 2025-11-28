import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function TenantManager() {
  // Query DIRETTA e SEMPLIFICATA per il debug
  const { data, error, isLoading } = useQuery({
    queryKey: ['debug-tenants'],
    queryFn: async () => {
      console.log("Tentativo connessione Supabase...");
      
      // 1. Chiediamo TUTTE le prenotazioni, senza filtri complessi
      const { data: rawData, error: rawError } = await supabase
        .from('bookings')
        .select(`
          id,
          nome_ospite,
          tipo_affitto,
          user_id,
          tenant_profiles (*)
        `);
        
      if (rawError) {
        console.error("Errore Supabase:", rawError);
        throw rawError;
      }
      
      console.log("Dati ricevuti:", rawData);
      return rawData;
    }
  });

  if (isLoading) return <div className="p-10 text-2xl font-bold text-blue-600">CARICAMENTO IN CORSO... (Guarda anche la console F12)</div>;

  if (error) return (
    <div className="p-10 bg-red-100 text-red-700 border-2 border-red-500 rounded">
      <h2 className="text-2xl font-bold">ERRORE RILEVATO</h2>
      <pre className="mt-4 p-4 bg-white rounded shadow text-sm font-mono whitespace-pre-wrap">
        {JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );

  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">DIAGNOSTICA DATI</h1>
      
      <div className="grid gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <p><strong>Totale Record Trovati:</strong> {data?.length}</p>
        </div>

        {data?.map((item: any, index: number) => (
          <div key={item.id} className="p-4 border-2 border-gray-300 rounded bg-gray-50 font-mono text-xs">
            <p className="font-bold text-lg mb-2 text-blue-600">Record #{index + 1}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><span className="font-bold">Ospite:</span> {item.nome_ospite}</p>
                <p><span className="font-bold">Tipo:</span> "{item.tipo_affitto}"</p>
                <p><span className="font-bold">User ID (Proprietario):</span> {item.user_id}</p>
              </div>
              <div className={item.tenant_profiles.length > 0 ? "bg-green-100 p-2" : "bg-red-100 p-2"}>
                <span className="font-bold">Profilo Collegato:</span> {item.tenant_profiles.length > 0 ? "SÌ (OK)" : "NO (ERRORE)"}
                <pre>{JSON.stringify(item.tenant_profiles, null, 2)}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}