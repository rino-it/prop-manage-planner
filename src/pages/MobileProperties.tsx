import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, PlayCircle, AlertTriangle } from 'lucide-react';

export default function MobileProperties() {
  // NIENTE useEffect -> NIENTE LOOP AUTOMATICO
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [status, setStatus] = useState("In attesa di comando...");

  const loadDataManual = async () => {
    setStatus("Caricamento in corso...");
    try {
      console.log("Avvio richiesta manuale...");
      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*')
        .limit(50); // Limitiamo per sicurezza

      if (error) throw error;

      console.log("Dati ricevuti:", data);
      setVehicles(data || []);
      setStatus("Dati caricati con successo.");
    } catch (err: any) {
      console.error(err);
      setStatus("ERRORE: " + err.message);
    }
  };

  return (
    <div className="p-10 space-y-6 min-h-screen bg-white">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-3xl font-bold text-red-600 flex items-center gap-2">
          <AlertTriangle /> MODALITÀ DEBUG MANUALE
        </h1>
        <p className="text-gray-600 mt-2">
          Questa pagina non fa nulla finché non lo ordini tu. 
          Serve a capire se il "blocco" è causato dal caricamento automatico.
        </p>
      </div>

      {/* 1. PULSANTE DI ATTIVAZIONE */}
      <div className="flex items-center gap-4 bg-slate-100 p-6 rounded-lg border-2 border-slate-300">
        <Button 
          onClick={loadDataManual} 
          size="lg" 
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg"
        >
          <PlayCircle className="mr-2 h-6 w-6"/> CLICCA PER CARICARE I DATI
        </Button>
        <div className="font-mono text-lg font-bold text-blue-800">
          Stato: {status}
        </div>
      </div>

      {/* 2. TABELLA RISULTATI (Semplificata al massimo) */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Veicolo / Nome</TableHead>
                <TableHead>Targa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center p-8 text-gray-400">
                    Nessun dato caricato. Premi il pulsante rosso.
                  </TableCell>
                </TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.id}</TableCell>
                    {/* Usiamo JSON.stringify per evitare crash su oggetti nulli */}
                    <TableCell>{v.veicolo || v.nome || "---"}</TableCell>
                    <TableCell>{v.targa || "---"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}