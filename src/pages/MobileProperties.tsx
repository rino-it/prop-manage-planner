import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MobileProperties() {
  const [status, setStatus] = useState("In attesa...");
  const [testInput, setTestInput] = useState("");

  // Test di connessione immediato
  useEffect(() => {
    async function checkDB() {
      try {
        const { data, error } = await supabase.from('properties_mobile').select('count');
        if (error) throw error;
        setStatus("✅ CONNESSO AL DB (Tabella trovata)");
      } catch (e: any) {
        setStatus("❌ ERRORE DB: " + e.message);
      }
    }
    checkDB();
  }, []);

  const handleTestSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Non sei loggato!");

    const { error } = await supabase.from('properties_mobile').insert({
      veicolo: testInput || "Veicolo Test",
      user_id: user.id
    });

    if (error) alert("Errore Salvataggio: " + error.message);
    else alert("✅ Salvataggio riuscito! Il DB funziona.");
  };

  return (
    <div className="p-10 space-y-6">
      <h1 className="text-2xl font-bold">Modalità Diagnostica</h1>
      
      {/* 1. STATUS MONITOR */}
      <Card className="p-4 bg-slate-100 border-2 border-slate-300">
        <p className="font-mono text-lg">{status}</p>
      </Card>

      {/* 2. TEST DI SCRITTURA */}
      <div className="flex gap-4">
        <Input 
          placeholder="Scrivi nome veicolo test..." 
          value={testInput}
          onChange={e => setTestInput(e.target.value)}
        />
        <Button onClick={handleTestSave} className="bg-green-600">PROVA A SALVARE</Button>
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Se vedi questa pagina e riesci a scrivere, il "Tilt" era causato dalla vecchia interfaccia.<br/>
        Se la pagina si blocca anche ora, il problema è in App.tsx o nel Router.
      </p>
    </div>
  );
}