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
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, FileText, Upload, Paperclip, Pencil, User, Forward, Eye, X } from 'lucide-react';
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

  // STATO PER ANTEPRIMA FILE
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

  // STATI FORM
  const [formData, setFormData] = useState({
    property_id: '',
    category: 'manutenzione',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // STATO: ADDEBITA ALL'INQUILINO
  const [chargeTenant, setChargeTenant] = useState(false);

  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // 1. QUERY AGGIORNATA: Include i documenti collegati
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_expenses')
        .select(`
          *,
          properties_real(nome),
          documents(id, url, nome, formato)
        `)
        .order('date', { ascending: false });
        
      if (error) {
        console.error("Errore fetch expenses:", error);
        return [];
      }
      return data || [];
    }
  });

  const openNewExpense = () => {
    setEditingId(null);
    setFormData({ 
        property_id: '', 
        category: 'manutenzione', 
        amount: '', 
        description: '', 
        date: format(new Date(), 'yyyy-MM-dd') 
    });
    setChargeTenant(false);
    setAttachment(null);
    setIsDialogOpen(true);
  };

  const openEditExpense = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
        property_id: expense.property_id || '',
        category: expense.category,
        amount: expense.amount.toString(),
        description: expense.description || '',
        date: format(new Date(expense.date), 'yyyy-MM-dd')
    });
    setChargeTenant(expense.charged_to_tenant || false);
    setAttachment(null);
    setIsDialogOpen(true);
  };

  // --- GESTIONE ANTEPRIMA ---
  const handlePreview = async (doc: any) => {
      if (!doc || !doc.url) return;
      
      try {
        // Genera URL firmato temporaneo (valido 1 ora)
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.url, 3600);

        if (error || !data?.signedUrl) throw new Error("Impossibile recuperare il file");

        setPreviewUrl(data.signedUrl);
        
        // Determina tipo file
        const isPdf = doc.url.toLowerCase().endsWith('.pdf') || doc.formato?.includes('pdf');
        setPreviewType(isPdf ? 'pdf' : 'image');
        
        setIsPreviewOpen(true);
      } catch (err) {
        toast({ title: "Errore file", description: "Impossibile aprire l'allegato.", variant: "destructive" });
      }
  };

  // --- LOGICA DI CREAZIONE/AGGIORNAMENTO (Invariata ma robusta) ---
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
            date: formData.date,
            charged_to_tenant: chargeTenant
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        if (chargeTenant && expenseData) {
            const { data: bookings } = await supabase
                .from('bookings')
                .select('id, nome_ospite')
                .eq('property_id', formData.property_id)
                .lte('data_inizio', formData.date)
                .gte('data_fine', formData.date)
                .limit(1);

            const activeBooking = bookings && bookings.length > 0 ? bookings[0] : null;

            if (activeBooking) {
                await supabase.from('tenant_payments').insert({
                    booking_id: activeBooking.id,
                    importo: parseFloat(formData.amount),
                    data_scadenza: formData.date,
                    stato: 'da_pagare',
                    tipo: mapCategoryToPaymentType(formData.category),
                    description: `Addebito: ${formData.description}`
                });
                toast({ title: "Addebito creato", description: `Spesa assegnata a ${activeBooking.nome_ospite}` });
            }
        }

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

      } catch (error: any) { throw error; } finally { setUploading(false); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      toast({ title: "Operazione completata" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const updateExpense = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      setUploading(true);
      try {
        const { error: updateError } = await supabase
          .from('property_expenses')
          .update({
            property_id: formData.property_id,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description,
            date: formData.date,
            charged_to_tenant: chargeTenant
          })
          .eq('id', editingId);

        if (updateError) throw updateError;

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
      if (editingId) updateExpense.mutate();
      else createExpense.mutate();
  };

  const mapCategoryToPaymentType = (cat: string) => {
      if (cat === 'bollette') return 'bolletta_luce';
      if (cat === 'condominio') return 'altro';
      return 'altro';
  };

  return (
    <div className="space-y-6">
      {/* --- DIALOG PER ANTEPRIMA FILE --- */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-lg">
                <h3 className="font-bold text-lg text-slate-800">Anteprima Ricevuta</h3>
                {/* Il pulsante di chiusura è gestito automaticamente dalla X del Dialog, ma possiamo aggiungerne uno se serve */}
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden relative">
                {!previewUrl && <p>Caricamento...</p>}
                
                {previewUrl && previewType === 'pdf' && (
                    <iframe src={previewUrl} className="w-full h-full rounded shadow-sm bg-white" title="Anteprima PDF" />
                )}
                
                {previewUrl && previewType === 'image' && (
                    <img src={previewUrl} alt="Ricevuta" className="max-w-full max-h-full object-contain shadow-lg rounded" />
                )}
            </div>
            <div className="p-4 border-t bg-white flex justify-end gap-2">
                <Button variant="outline" onClick={() => window.open(previewUrl!, '_blank')}>
                    <Forward className="w-4 h-4 mr-2" /> Apri in nuova scheda
                </Button>
                <Button onClick={() => setIsPreviewOpen(false)}>Chiudi</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Spese & Uscite</h1>
        <Button className="bg-blue-600" onClick={openNewExpense}>
            <Plus className="w-4 h-4 mr-2" /> Registra Spesa
        </Button>

        {/* --- DIALOG CREAZIONE/MODIFICA --- */}
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

              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="space-y-0.5">
                      <Label className="text-blue-900 font-bold flex items-center gap-2"><User className="w-4 h-4"/> A carico dell'inquilino?</Label>
                      <p className="text-[10px] text-blue-700">Se attivo, creerà una richiesta di pagamento nel portale inquilino.</p>
                  </div>
                  <Switch checked={chargeTenant} onCheckedChange={setChargeTenant} />
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
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ricevuta</TableHead><TableHead>Proprietà</TableHead><TableHead>Categoria</TableHead><TableHead>Descrizione</TableHead><TableHead>Importo</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses?.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell className="w-[120px]">{format(new Date(ex.date), 'dd/MM/yyyy')}</TableCell>
                  
                  {/* --- NUOVA COLONNA RICEVUTA --- */}
                  <TableCell>
                    {ex.documents && ex.documents.length > 0 ? (
                        <Button variant="outline" size="sm" className="h-8 gap-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handlePreview(ex.documents[0])}>
                            <Eye className="w-4 h-4" /> 
                            <span className="hidden sm:inline">Vedi</span>
                        </Button>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Nessuna</span>
                    )}
                  </TableCell>

                  <TableCell className="font-medium">{ex.properties_real?.nome}</TableCell>
                  <TableCell className="capitalize">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs block w-fit mb-1">{ex.category}</span>
                      {ex.charged_to_tenant && <span className="text-[10px] text-blue-600 flex items-center gap-1 font-bold"><Forward className="w-3 h-3"/> Addebitato</span>}
                  </TableCell>
                  <TableCell>{ex.description}</TableCell>
                  <TableCell className="font-bold text-red-600">- €{ex.amount}</TableCell>
                  <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditExpense(ex)} className="hover:text-blue-600"><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Eliminare questa spesa?")) deleteExpense.mutate(ex.id) }} className="hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
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