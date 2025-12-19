import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

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

  // ----------------------------------------------------------------
  // FUNZIONE FETCH CON ABORT CONTROLLER (IL FIX ANTI-BLOCCO)
  // ----------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController(); // Crea un "interruttore"
    
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        // Passiamo il segnale di abort alla query (se supportato) o controlliamo lo stato
        const { data, error } = await supabase
          .from('properties_mobile')
          .select('*')
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal); // Supabase supporta abortSignal

        if (error) throw error;
        
        // Aggiorna lo stato SOLO se il componente è ancora montato
        if (!controller.signal.aborted) {
          setVehicles(data || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') { // Ignora errori di "navigazione interrotta"
          console.error("Errore fetch:", err);
          if (!controller.signal.aborted) setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchVehicles();

    // CLEANUP FUNCTION: React esegue questo quando cambi pagina
    return () => {
      controller.abort(); // STOPPA TUTTO IMMEDIATAMENTE
    };
  }, []); // Esegui solo al mount

  // ----------------------------------------------------------------
  // LOGICHE DI SALVATAGGIO / ELIMINAZIONE
  // ----------------------------------------------------------------

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Sessione scaduta.");

      const payload = {
        nome: formData.veicolo,
        categoria: 'Veicolo',
        status: 'active',
        veicolo: formData.veicolo,
        targa: formData.targa ? formData.targa.toUpperCase() : null,
        anno: formData.anno ? parseInt(formData.anno) : null,
        km: formData.km ? parseInt(formData.km) : 0,
        data_revisione: formData.data_revisione || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        note: formData.note,
        user_id: user.id
      };

      const { error } = await supabase.from('properties_mobile').insert(payload);
      if (error) throw error;

      toast({ title: "Salvataggio riuscito!" });
      setIsDialogOpen(false);
      setFormData({ veicolo: '', targa: '', anno: '', km: '', data_revisione: '', scadenza_assicurazione: '', note: '' });
      
      // Ricarica la pagina forzatamente per aggiornare i dati senza loop
      window.location.reload(); 

    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo veicolo?")) return;
    try {
      const { error } = await supabase.from('properties_mobile').delete().eq('id', id);
      if (error) throw error;
      window.location.reload(); // Refresh pulito
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try { return format(parseISO(dateStr), 'dd/MM/yyyy'); } catch { return dateStr; }
  };

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------

  return (
    <div className="p-8 space-y-6 min-h-screen bg-gray-50 pb-20"> {/* Padding bottom extra */}
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
                <TableHead>Scadenze</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center p-4">Caricamento...</TableCell></TableRow>
              ) : vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center p-8 text-gray-400">Nessun veicolo</TableCell></TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.veicolo || v.nome}</TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs border uppercase">{v.targa || '-'}</span></TableCell>
                    <TableCell>{v.km?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                        <div>Rev: {formatDate(v.data_revisione)}</div>
                        <div>Ass: {formatDate(v.scadenza_assicurazione)}</div>
                    </TableCell>
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
              <div><Label>Veicolo</Label><Input value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} /></div>
              <div><Label>Targa</Label><Input value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} /></div>
            </div>
            {/* ... Altri campi (semplificati per brevità nel fix, ma usa pure quelli di prima se vuoi) ... */}
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Anno</Label><Input type="number" value={formData.anno} onChange={e => setFormData({...formData, anno: e.target.value})}/></div>
               <div><Label>Km</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Revisione</Label><Input type="date" value={formData.data_revisione} onChange={e => setFormData({...formData, data_revisione: e.target.value})}/></div>
               <div><Label>Assicurazione</Label><Input type="date" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})}/></div>
            </div>
            <Button onClick={handleSave} className="w-full bg-blue-600">Salva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}