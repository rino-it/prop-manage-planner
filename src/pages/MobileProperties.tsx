import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

export default function MobileProperties() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    veicolo: '', targa: '', anno: '', km: '', 
    data_revisione: '', scadenza_assicurazione: '', note: ''
  });

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error("Errore fetch:", err);
      toast({ 
        title: "Errore caricamento", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Sessione scaduta.");

      // MODIFICA CRITICA: Gestione sicura dei numeri per evitare errore 400
      const payload = {
        nome: formData.veicolo, // Usa il nome veicolo anche come 'nome'
        categoria: 'Veicolo',   // Ora accettato come testo grazie all'SQL
        status: 'active',
        veicolo: formData.veicolo,
        targa: formData.targa ? formData.targa.toUpperCase() : null,
        // Se stringa vuota, manda null invece di NaN o errore
        anno: formData.anno && !isNaN(parseInt(formData.anno)) ? parseInt(formData.anno) : null,
        km: formData.km && !isNaN(parseInt(formData.km)) ? parseInt(formData.km) : 0,
        data_revisione: formData.data_revisione || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        note: formData.note,
        user_id: user.id
      };

      const { error } = await supabase.from('properties_mobile').insert(payload);
      if (error) throw error;

      toast({ title: "Veicolo salvato con successo!" });
      setIsDialogOpen(false);
      setFormData({ veicolo: '', targa: '', anno: '', km: '', data_revisione: '', scadenza_assicurazione: '', note: '' });
      fetchVehicles();

    } catch (err: any) {
      console.error("Errore salvataggio:", err); // Log in console per debug
      toast({ title: "Errore salvataggio", description: err.message || "Verifica i dati inseriti", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo veicolo?")) return;
    try {
      const { error } = await supabase.from('properties_mobile').delete().eq('id', id);
      if (error) throw error;
      fetchVehicles();
      toast({ title: "Veicolo eliminato" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err.message, variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try { return format(parseISO(dateStr), 'dd/MM/yyyy'); } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="h-8 w-8 text-blue-600"/> Parco Mezzi
        </h1>
        <Button className="bg-blue-600" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4"/> Aggiungi Veicolo
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
                <TableRow><TableCell colSpan={5} className="text-center p-8">Caricamento in corso...</TableCell></TableRow>
              ) : vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center p-8 text-gray-400">Nessun veicolo presente nel database.</TableCell></TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.veicolo || v.nome || "N/A"}</TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs border uppercase">{v.targa || '-'}</span></TableCell>
                    <TableCell>{v.km?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                        <div className={v.data_revisione ? "" : "opacity-50"}>Rev: {formatDate(v.data_revisione)}</div>
                        <div className={v.scadenza_assicurazione ? "" : "opacity-50"}>Ass: {formatDate(v.scadenza_assicurazione)}</div>
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
              <div><Label>Veicolo</Label><Input value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} placeholder="Es. Fiat Ducato" /></div>
              <div><Label>Targa</Label><Input value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} placeholder="AA 000 BB" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Anno</Label><Input type="number" value={formData.anno} onChange={e => setFormData({...formData, anno: e.target.value})}/></div>
               <div><Label>Km</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border">
               <div><Label>Scad. Revisione</Label><Input type="date" value={formData.data_revisione} onChange={e => setFormData({...formData, data_revisione: e.target.value})}/></div>
               <div><Label>Scad. Assicurazione</Label><Input type="date" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})}/></div>
            </div>
            <div className="space-y-1"><Label>Note</Label><Input value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
            
            <Button onClick={handleSave} className="w-full bg-blue-600 font-bold hover:bg-blue-700">Salva Veicolo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}