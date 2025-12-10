import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// AGGIUNTO: Pencil per l'icona modifica
import { Plus, Trash2, FileText, Upload, Paperclip, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: properties } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // STATO PER LA MODIFICA
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    property_id: '',
    category: 'manutenzione',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('property_expenses')
        .select('*, properties_real(nome)')
        .order('date', { ascending: false });
      return data || [];
    }
  });

  // FUNZIONE PER APRIRE IL DIALOG IN MODALITÀ "NUOVA"
  const openNewExpense = () => {
    setEditingId(null);
    setFormData({ 
        property_id: '', 
        category: 'manutenzione', 
        amount: '', 
        description: '', 
        date: format(new Date(), 'yyyy-MM-dd') 
    });
    setAttachment(null);
    setIsDialogOpen(true);
  };

  // FUNZIONE PER APRIRE IL DIALOG IN MODALITÀ "MODIFICA"
  const openEditExpense = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
        property_id: expense.property_id || '',
        category: expense.category,
        amount: expense.amount.toString(),
        description: expense.description || '',
        date: format(new Date(expense.date), 'yyyy-MM-dd')
    });
    setAttachment(null); // Reset allegato (se vuole cambiarlo lo ricarica)
    setIsDialogOpen(true);
  };

  const createExpense = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        const { data: expenseData, error: expenseError } = await supabase
          .from('property_expenses')
          .insert({
            property_id: formData.property_id,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description,
            date: formData.date
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        if (attachment && expenseData) {
            const fileExt = attachment.name.split('.').pop();
            const fileName = `expense_${expenseData.id}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, attachment);
            if (upError) throw upError;

            await supabase.from('documents').insert({
                property_real_id: formData.property_id,
                expense_id: expenseData.id,
                nome: `Ricevuta: ${formData.description || 'Spesa'}`,
                tipo: 'spesa',
                url: fileName,
                user_id: (await supabase.auth.getUser()).data.user?.id
            });
        }
      } catch (error) { throw error; } finally { setUploading(false); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['property-docs'] });
      setIsDialogOpen(false);
      toast({ title: "Spesa registrata" });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // MUTATION PER L'AGGIORNAMENTO
  const updateExpense = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      setUploading(true);
      try {
        // 1. Aggiorna i dati della spesa
        const { error: updateError } = await supabase
          .from('property_expenses')
          .update({
            property_id: formData.property_id,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description,
            date: formData.date
          })
          .eq('id', editingId);

        if (updateError) throw updateError;

        // 2. Se c'è un NUOVO allegato, caricalo e crea il documento
        if (attachment) {
            const fileExt = attachment.name.split('.').pop();
            const fileName = `expense_${editingId}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, attachment);
            if (upError) throw upError;

            await supabase.from('documents').insert({
                property_real_id: formData.property_id,
                expense_id: editingId,
                nome: `Ricevuta (Aggiornata): ${formData.description}`,
                tipo: 'spesa',
                url: fileName,
                user_id: (await supabase.auth.getUser()).data.user?.id
            });
        }
      } catch (error) { throw error; } finally { setUploading(false); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      toast({ title: "Spesa aggiornata" });
    },
    onError: () => toast({ title: "Errore aggiornamento", variant: "destructive" })
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('property_expenses').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: "Spesa eliminata" });
    }
  });

  const handleSubmit = () => {
      if (editingId) {
          updateExpense.mutate();
      } else {
          createExpense.mutate();
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Spese & Uscite</h1>
        <Button className="bg-blue-600" onClick={openNewExpense}>
            <Plus className="w-4 h-4 mr-2" /> Registra Spesa
        </Button>

        {/* DIALOG UNICO (CREATE / EDIT) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingId ? 'Modifica Spesa' : 'Nuova Spesa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Proprietà</Label>
                <Select value={formData.property_id} onValueChange={(v) => setFormData({...formData, property_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutenzione">Manutenzione</SelectItem>
                    <SelectItem value="bollette">Utenze/Bollette</SelectItem>
                    <SelectItem value="tasse">Tasse (IMU/TARI)</SelectItem>
                    <SelectItem value="condominio">Condominio</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Importo (€)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Data</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
              </div>
              <div className="grid gap-2"><Label>Descrizione</Label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              
              <div className="grid gap-2 border p-3 rounded-md bg-slate-50 border-dashed border-slate-300">
                <Label className="flex items-center gap-2 cursor-pointer">
                    <Paperclip className="w-4 h-4 text-blue-600" /> {editingId ? 'Aggiungi nuovo allegato (Opzionale)' : 'Allegato (Fattura/Scontrino)'}
                </Label>
                <Input type="file" className="bg-white" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                {attachment && <p className="text-xs text-green-600 font-medium">File selezionato: {attachment.name}</p>}
              </div>

              <Button className="w-full bg-blue-600" onClick={handleSubmit} disabled={!formData.property_id || !formData.amount || uploading}>
                  {uploading ? "Salvataggio..." : (editingId ? "Aggiorna Spesa" : "Salva Spesa")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Storico Uscite</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Proprietà</TableHead><TableHead>Categoria</TableHead><TableHead>Descrizione</TableHead><TableHead>Importo</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses?.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell>{format(new Date(ex.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium">{ex.properties_real?.nome}</TableCell>
                  <TableCell className="capitalize"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{ex.category}</span></TableCell>
                  <TableCell>{ex.description}</TableCell>
                  <TableCell className="font-bold text-red-600">- €{ex.amount}</TableCell>
                  <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* TASTO MODIFICA */}
                        <Button variant="ghost" size="icon" onClick={() => openEditExpense(ex)} className="hover:text-blue-600">
                            <Pencil className="w-4 h-4" />
                        </Button>
                        {/* TASTO ELIMINA */}
                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Eliminare questa spesa?")) deleteExpense.mutate(ex.id) }} className="hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}