import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ------------------------------------------------------------------
// VERSIONE NATIVA: Rimuove React Query per isolare il problema di loop
// ------------------------------------------------------------------

export default function MobileProperties() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    veicolo: '', targa: '', anno: '', km: '', 
    data_revisione: '', scadenza_assicurazione: '', note: ''
  });

  // 1. FETCH DATI MANUALE (Più sicuro per il debug)
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Tentativo connessione DB...");

      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log("Dati ricevuti:", data);
      setVehicles(data || []);
    } catch (err: any) {
      console.error("ERRORE CRITICO:", err);
      setError(err.message || "Errore sconosciuto di connessione");
    } finally {
      setLoading(false);
    }
  };

  // Esegui solo al primo caricamento (evita loop)
  useEffect(() => {
    fetchVehicles();
  }, []);

  // 2. FUNZIONE SALVATAGGIO
  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Sessione scaduta. Fai login di nuovo.");
        return;
      }

      const payload = {
        veicolo: formData.veicolo,
        targa: formData.targa,
        anno: formData.anno ? parseInt(formData.anno) : null,
        km: formData.km ? parseInt(formData.km) : 0,
        data_revisione: formData.data_revisione || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        note: formData.note,
        user_id: user.id
      };

      const { error } = await supabase.from('properties_mobile').insert(payload);
      if (error) throw error;

      toast({ title: "Veicolo salvato correttamente" });
      setIsDialogOpen(false);
      fetchVehicles(); // Ricarica la lista

    } catch (err: any) {
      alert("Errore salvataggio: " + err.message);
    }
  };

  // 3. FUNZIONE ELIMINA
  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro?")) return;
    try {
      const { error } = await supabase.from('properties_mobile').delete().eq('id', id);
      if (error) throw error;
      fetchVehicles();
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  // ------------------------------------------------------------------
  // INTERFACCIA UTENTE (Semplificata per evitare crash grafici)
  // ------------------------------------------------------------------

  if (loading) return <div className="p-10 text-center animate-pulse">Caricamento in corso...</div>;

  if (error) return (
    <div className="p-8 m-4 bg-red-50 border border-red-200 rounded text-red-700">
      <div className="flex items-center gap-2 mb-2 font-bold text-xl">
        <AlertTriangle /> ERRORE DI SISTEMA
      </div>
      <p className="font-mono bg-white p-2 rounded border mb-4">{error}</p>
      <Button onClick={fetchVehicles} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/> Riprova</Button>
    </div>
  );

  return (
    <div className="p-8 space-y-6 min-h-screen bg-gray-50">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="text-blue-600"/> Parco Mezzi
        </h1>
        <Button className="bg-blue-600" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4"/> Aggiungi
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Km</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center p-8 text-gray-400">Nessun veicolo presente</TableCell></TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.veicolo || '-'}</TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs border uppercase">{v.targa || '-'}</span></TableCell>
                    <TableCell>{v.km}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="text-red-500 w-4 h-4"/>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo Veicolo</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Veicolo</Label><Input value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} placeholder="Es. Fiat Panda" /></div>
              <div><Label>Targa</Label><Input value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} placeholder="AA 000 BB" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Anno</Label><Input type="number" value={formData.anno} onChange={e => setFormData({...formData, anno: e.target.value})}/></div>
               <div><Label>Km</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Rev.</Label><Input type="date" value={formData.data_revisione} onChange={e => setFormData({...formData, data_revisione: e.target.value})}/></div>
               <div><Label>Assic.</Label><Input type="date" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})}/></div>
            </div>
            <Button onClick={handleSave} className="w-full bg-blue-600 font-bold">Salva Veicolo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}