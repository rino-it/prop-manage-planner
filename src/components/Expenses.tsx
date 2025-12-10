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
import { Plus, Trash2, FileText, Upload, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: properties } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newExpense, setNewExpense] = useState({
    property_id: '',
    category: 'manutenzione',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // STATO PER IL FILE ALLEGATO
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

  const createExpense = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        // 1. Crea la Spesa
        const { data: expenseData, error: expenseError } = await supabase
          .from('property_expenses')
          .insert({
            property_id: newExpense.property_id,
            category: newExpense.category,
            amount: parseFloat(newExpense.amount),
            description: newExpense.description,
            date: newExpense.date
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // 2. Se c'è un file, caricalo e crea il Documento collegato
        if (attachment && expenseData) {
            const fileExt = attachment.name.split('.').pop();
            const fileName = `expense_${expenseData.id}_${Date.now()}.${fileExt}`;
            
            // Upload Storage
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, attachment);
            if (upError) throw upError;

            // Record DB Documenti (Collegato alla proprietà E alla spesa)
            const { error: docError } = await supabase.from('documents').insert({
                property_real_id: newExpense.property_id,
                expense_id: expenseData.id, // LINK AUTOMATICO
                nome: `Ricevuta: ${newExpense.description || 'Spesa'}`,
                tipo: 'spesa',
                url: fileName,
                user_id: (await supabase.auth.getUser()).data.user?.id
            });
            if (docError) throw docError;
        }

      } catch (error) {
        throw error;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['property-docs'] }); // Aggiorna anche la scheda proprietà
      setIsDialogOpen(false);
      setNewExpense({ property_id: '', category: 'manutenzione', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
      setAttachment(null);
      toast({ title: "Spesa registrata", description: attachment ? "Allegato salvato nei documenti." : "" });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Spese & Uscite</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button className="bg-blue-600"><Plus className="w-4 h-4 mr-2" /> Registra Spesa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Spesa</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Proprietà</Label>
                <Select onValueChange={(v) => setNewExpense({...newExpense, property_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => setNewExpense({...newExpense, category: v})} defaultValue="manutenzione">
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
                <div className="grid gap-2"><Label>Importo (€)</Label><Input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Data</Label><Input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} /></div>
              </div>
              <div className="grid gap-2"><Label>Descrizione</Label><Input value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} /></div>
              
              {/* CAMPO UPLOAD ALLEGATO */}
              <div className="grid gap-2 border p-3 rounded-md bg-slate-50 border-dashed border-slate-300">
                <Label className="flex items-center gap-2 cursor-pointer">
                    <Paperclip className="w-4 h-4 text-blue-600" /> Allegato (Fattura/Scontrino)
                </Label>
                <Input type="file" className="bg-white" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                {attachment && <p className="text-xs text-green-600 font-medium">File selezionato: {attachment.name}</p>}
              </div>

              <Button className="w-full bg-blue-600" onClick={() => createExpense.mutate()} disabled={!newExpense.property_id || !newExpense.amount || uploading}>
                  {uploading ? "Salvataggio..." : "Salva Spesa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Storico Uscite</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Proprietà</TableHead><TableHead>Categoria</TableHead><TableHead>Descrizione</TableHead><TableHead>Importo</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses?.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell>{format(new Date(ex.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium">{ex.properties_real?.nome}</TableCell>
                  <TableCell className="capitalize"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{ex.category}</span></TableCell>
                  <TableCell>{ex.description}</TableCell>
                  <TableCell className="font-bold text-red-600">- €{ex.amount}</TableCell>
                  <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(ex.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
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