import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Plus, Pencil, Trash2, Shield, Wrench, AlertTriangle } from 'lucide-react';
import { format, isPast, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function MobileProperties() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    veicolo: '', targa: '', anno: '', km: '', 
    data_revisione: '', scadenza_assicurazione: '', note: ''
  });

  const { data: vehicles = [], isLoading, error } = useQuery({
    queryKey: ['mobile_properties'],
    queryFn: async () => {
      // Seleziona tutto in modo esplicito per debugging
      const { data, error } = await supabase.from('properties_mobile').select('*').order('created_at', { ascending: false });
      
      if (error) {
        console.error("Errore fetch veicoli:", error);
        throw error;
      }
      return data || [];
    }
  });

  if (error) {
      return <div className="p-8 text-red-600 font-bold">Errore di caricamento: {(error as any).message}. Controlla il Database.</div>;
  }

  const openNew = () => {
    setEditingId(null);
    setFormData({ veicolo: '', targa: '', anno: '', km: '', data_revisione: '', scadenza_assicurazione: '', note: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (v: any) => {
    setEditingId(v.id);
    setFormData({
      veicolo: v.veicolo || '', targa: v.targa || '', anno: v.anno ? String(v.anno) : '', km: v.km ? String(v.km) : '',
      data_revisione: v.data_revisione || '', scadenza_assicurazione: v.scadenza_assicurazione || '', note: v.note || ''
    });
    setIsDialogOpen(true);
  };

  const upsertVehicle = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");
      
      const payload = {
        veicolo: formData.veicolo,
        targa: formData.targa ? formData.targa.toUpperCase() : null,
        anno: formData.anno ? parseInt(formData.anno) : null,
        km: formData.km ? parseInt(formData.km) : 0,
        data_revisione: formData.data_revisione || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        note: formData.note,
        user_id: user.id
      };

      if (editingId) {
        const { error } = await supabase.from('properties_mobile').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties_mobile').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile_properties'] });
      setIsDialogOpen(false);
      toast({ title: editingId ? "Veicolo aggiornato" : "Veicolo aggiunto" });
    },
    onError: (err: any) => toast({ title: "Errore Salvataggio", description: err.message, variant: "destructive" })
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties_mobile').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile_properties'] });
      toast({ title: "Veicolo rimosso" });
    }
  });

  const renderDateStatus = (dateStr: string) => {
    if (!dateStr) return <span className="text-gray-300">-</span>;
    const date = parseISO(dateStr);
    if (!isValid(date)) return <span className="text-red-300">Data invalida</span>;
    
    const expired = isPast(date);
    return (
      <span className={`flex items-center gap-1 font-medium ${expired ? 'text-red-600' : 'text-green-700'}`}>
        {expired && <AlertTriangle className="w-3 h-3" />}
        {format(date, 'dd/MM/yyyy')}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><Truck className="w-8 h-8 text-blue-600" /> Parco Mezzi</h1>
        </div>
        <Button className="bg-blue-600" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Aggiungi</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Veicolo</TableHead><TableHead>Targa</TableHead><TableHead>Anno</TableHead><TableHead>Km</TableHead>
                <TableHead>Revisione</TableHead><TableHead>Assicurazione</TableHead><TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (<TableRow><TableCell colSpan={7} className="text-center p-4">Caricamento...</TableCell></TableRow>) : 
               vehicles.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center p-8 text-gray-400">Nessun veicolo.</TableCell></TableRow>) : (
                vehicles.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-bold">{v.veicolo || 'Senza nome'}</TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs border uppercase">{v.targa || '-'}</span></TableCell>
                    <TableCell>{v.anno || '-'}</TableCell>
                    <TableCell>{v.km ? v.km.toLocaleString() : '0'} km</TableCell>
                    <TableCell>{renderDateStatus(v.data_revisione)}</TableCell>
                    <TableCell>{renderDateStatus(v.scadenza_assicurazione)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Eliminare?")) deleteVehicle.mutate(v.id) }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? 'Modifica' : 'Nuovo'} Veicolo</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Veicolo</Label><Input placeholder="Es. Fiat Ducato" value={formData.veicolo} onChange={e => setFormData({...formData, veicolo: e.target.value})} /></div>
                <div className="space-y-1"><Label>Targa</Label><Input placeholder="AA 000 BB" value={formData.targa} onChange={e => setFormData({...formData, targa: e.target.value})} className="uppercase" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Anno</Label><Input type="number" value={formData.anno} onChange={e => setFormData({...formData, anno: e.target.value})} /></div>
                <div className="space-y-1"><Label>Km</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} /></div>
            </div>
            <div className="p-4 bg-blue-50 rounded border border-blue-100 grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-blue-900 flex items-center gap-2"><Wrench className="w-4 h-4"/> Scad. Revisione</Label><Input type="date" value={formData.data_revisione} onChange={e => setFormData({...formData, data_revisione: e.target.value})} className="bg-white" /></div>
                <div className="space-y-2"><Label className="text-blue-900 flex items-center gap-2"><Shield className="w-4 h-4"/> Scad. Assicurazione</Label><Input type="date" value={formData.scadenza_assicurazione} onChange={e => setFormData({...formData, scadenza_assicurazione: e.target.value})} className="bg-white" /></div>
            </div>
            <div className="space-y-1"><Label>Note</Label><Input value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
            <Button onClick={() => upsertVehicle.mutate()} className="w-full bg-blue-600 mt-2">{editingId ? "Salva" : "Crea"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}