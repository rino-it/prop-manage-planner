import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Plus, Trash2, Pencil, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, addDays } from 'date-fns';

export default function MobileProperties() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // STATO PER LA MODIFICA
  const [editingId, setEditingId] = useState<string | null>(null);

  const { toast } = useToast();
  const [formData, setFormData] = useState({
    veicolo: '', 
    targa: '', 
    anno: '', 
    km: '', 
    data_revisione: '', 
    scadenza_assicurazione: '', 
    scadenza_bollo: '',
    note: ''
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
      toast({ title: "Errore caricamento", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const resetForm = () => {
    setFormData({ 
        veicolo: '', targa: '', anno: '', km: '', 
        data_revisione: '', scadenza_assicurazione: '', scadenza_bollo: '', note: '' 
    });
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (v: any) => {
    setEditingId(v.id);
    setFormData({
      veicolo: v.veicolo || v.nome || '',
      targa: v.targa || '',
      anno: v.anno ? v.anno.toString() : '',
      km: v.km ? v.km.toString() : '',
      data_revisione: v.data_revisione || '',
      scadenza_assicurazione: v.scadenza_assicurazione || '',
      scadenza_bollo: v.scadenza_bollo || '',
      note: v.note || ''
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Sessione scaduta.");

      const payload = {
        nome: formData.veicolo, // Mantieni sync con 'nome' per compatibilità
        categoria: 'Veicolo',
        status: 'active',
        veicolo: formData.veicolo,
        targa: formData.targa ? formData.targa.toUpperCase() : null,
        anno: formData.anno && !isNaN(parseInt(formData.anno)) ? parseInt(formData.anno) : null,
        km: formData.km && !isNaN(parseInt(formData.km)) ? parseInt(formData.km) : 0,
        
        // NUOVI CAMPI DATE
        data_revisione: formData.data_revisione || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        scadenza_bollo: formData.scadenza_bollo || null,
        
        note: formData.note,
        user_id: user.id
      };

      if (editingId) {
        const { error } = await supabase.from('properties_mobile').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: "Veicolo aggiornato!" });
      } else {
        const { error } = await supabase.from('properties_mobile').insert(payload);
        if (error) throw error;
        toast({ title: "Veicolo creato!" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchVehicles();

    } catch (err: any) {
      console.error("Errore salvataggio:", err);
      toast({ title: "Errore salvataggio", description: err.message, variant: "destructive" });
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

  // Funzione per evidenziare scadenze vicine (es. entro 30 giorni)
  const isExpiringSoon = (dateStr: string) => {
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      const today = new Date();
      const warningDate = addDays(today, 30);
      return isBefore(date, warningDate) && isBefore(today, date); // Tra oggi e 30gg
  };

  const isExpired = (dateStr: string) => {
      if (!dateStr) return false;
      return isBefore(parseISO(dateStr), new Date());
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-8 w-8 text-blue-600"/> Parco Mezzi
            </h1>
            <p className="text-gray-500 text-sm">Gestione flotta e scadenze</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4"/> Aggiungi Veicolo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Stato Scadenze</TableHead>
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
                    <TableCell className="font-medium">
                        <div className="text-base text-gray-900">{v.veicolo || v.nome}</div>
                        <div className="text-xs text-gray-500">{v.anno}</div>
                    </TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs border uppercase">{v.targa || '-'}</span></TableCell>
                    <TableCell>{v.km?.toLocaleString()}</TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                            {/* REVISIONE */}
                            <div className={`flex items-center gap-2 ${isExpired(v.data_revisione) ? 'text-red-600 font-bold' : isExpiringSoon(v.data_revisione) ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
                                <Calendar className="w-3 h-3"/> Rev: {formatDate(v.data_revisione)}
                                {isExpired(v.data_revisione) && <AlertTriangle className="w-3 h-3"/>}
                            </div>
                            {/* ASSICURAZIONE */}
                            <div className={`flex items-center gap-2 ${isExpired(v.scadenza_assicurazione) ? 'text-red-600 font-bold' : isExpiringSoon(v.scadenza_assicurazione) ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
                                <Calendar className="w-3 h-3"/> Ass: {formatDate(v.scadenza_assicurazione)}
                                {isExpired(v.scadenza_assicurazione) && <AlertTriangle className="w-3 h-3"/>}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(v)} className="hover:text-blue-600">
                          <Pencil className="h-4 w-4"/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)} className="hover:text-red-600">
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
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
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Veicolo' : 'Nuovo Veicolo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Veicolo</Label><Input value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} placeholder="Es. Fiat Ducato" /></div>
              <div><Label>Targa</Label><Input value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} placeholder="AA 000 BB" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div><Label>Anno</Label><Input type="number" value={formData.anno} onChange={e => setFormData({...formData, anno: e.target.value})}/></div>
               <div><Label>Km</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})}/></div>
            </div>
            
            {/* SEZIONE SCADENZE */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <Label className="text-slate-700 font-bold flex items-center gap-2"><Calendar className="w-4 h-4"/> Scadenze Legali</Label>
                <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-xs">Scad. Revisione</Label><Input type="date" value={formData.data_revisione} onChange={e => setFormData({...formData, data_revisione: e.target.value})}/></div>
                    <div><Label className="text-xs">Scad. Assicurazione</Label><Input type="date" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})}/></div>
                    <div><Label className="text-xs">Scad. Bollo</Label><Input type="date" value={formData.scadenza_bollo} onChange={e => setFormData({...formData, scadenza_bollo: e.target.value})}/></div>
                </div>
            </div>

            <div className="space-y-1"><Label>Note</Label><Input value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
            
            <Button onClick={handleSave} className="w-full bg-blue-600 font-bold hover:bg-blue-700">
              {editingId ? 'Aggiorna Veicolo' : 'Salva Veicolo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}