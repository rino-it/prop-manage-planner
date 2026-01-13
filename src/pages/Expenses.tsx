import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, User, Forward, Eye, Paperclip, Filter, X, Car, Home } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Fetch Immobili
  const { data: properties } = usePropertiesReal();
  
  // Fetch Veicoli (Nuova Funzionalità)
  const { data: vehicles } = useQuery({
    queryKey: ['mobile_properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa, nome');
      return data || [];
    }
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- FILTRI ---
  const [filterType, setFilterType] = useState("all"); // 'real' | 'mobile' | 'all'
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

  // --- FORM DATA ---
  const [formData, setFormData] = useState({
    target_type: 'real', // 'real' (Immobile) o 'mobile' (Veicolo)
    target_id: '',       // ID dell'immobile o del veicolo
    category: 'manutenzione',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [chargeTenant, setChargeTenant] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- QUERY SPESE (Tabella Unificata 'payments') ---
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', filterType, filterCategory, filterStart, filterEnd],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          *,
          properties_real (nome),
          properties_mobile (veicolo, targa, nome),
          documents (id, url, nome, formato)
        `)
        .order('scadenza', { ascending: false });
      
      // Filtri
      if (filterCategory !== "all") query = query.eq('categoria', filterCategory);
      if (filterStart) query = query.gte('scadenza', filterStart);
      if (filterEnd) query = query.lte('scadenza', filterEnd);
      
      // Filtro Tipo (Immobile vs Veicolo)
      if (filterType === 'real') query = query.not('property_real_id', 'is', null);
      if (filterType === 'mobile') query = query.not('property_mobile_id', 'is', null);
        
      const { data, error } = await query;

      if (error) {
        console.error("Errore fetch expenses:", error);
        return [];
      }
      return data || [];
    }
  });

  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.importo || 0), 0);

  const resetFilters = () => {
      setFilterType("all");
      setFilterCategory("all");
      setFilterStart("");
      setFilterEnd("");
  };

  const openNewExpense = () => {
    setEditingId(null);
    setFormData({ 
        target_type: 'real',
        target_id: '', 
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
    const isMobile = !!expense.property_mobile_id;
    setFormData({
        target_type: isMobile ? 'mobile' : 'real',
        target_id: isMobile ? expense.property_mobile_id : expense.property_real_id,
        category: expense.categoria || 'altro',
        amount: expense.importo.toString(),
        description: expense.descrizione || '',
        date: expense.scadenza ? format(new Date(expense.scadenza), 'yyyy-MM-dd') : ''
    });
    setChargeTenant(false); 
    setAttachment(null);
    setIsDialogOpen(true);
  };

  const handlePreview = async (doc: any) => {
      if (!doc || !doc.url) return;
      try {
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.url, 3600);

        if (error || !data?.signedUrl) throw new Error("Impossibile recuperare il file");

        setPreviewUrl(data.signedUrl);
        const isPdf = doc.url.toLowerCase().endsWith('.pdf') || doc.formato?.includes('pdf');
        setPreviewType(isPdf ? 'pdf' : 'image');
        setIsPreviewOpen(true);
      } catch (err) {
        toast({ title: "Errore file", description: "Impossibile aprire l'allegato.", variant: "destructive" });
      }
  };

  // --- SALVATAGGIO SPESA (Create / Update) ---
  const saveExpense = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Prepara il payload unificato
        const payload = {
            user_id: user?.id,
            property_real_id: formData.target_type === 'real' ? formData.target_id : null,
            property_mobile_id: formData.target_type === 'mobile' ? formData.target_id : null,
            categoria: formData.category, // Ora è testo libero, accetta tutto
            importo: parseFloat(formData.amount),
            importo_originale: parseFloat(formData.amount),
            descrizione: formData.description,
            scadenza: formData.date,
            stato: 'pagato',
            ricorrenza_tipo: 'mensile'
        };

        let expenseId;

        if (editingId) {
            // UPDATE
            const { error } = await supabase.from('payments').update(payload).eq('id', editingId);
            if (error) throw error;
            expenseId = editingId;
        } else {
            // CREATE
            const { data, error } = await supabase.from('payments').insert(payload).select().single();
            if (error) throw error;
            expenseId = data.id;
        }

        // 2. Addebito Inquilino (Solo per Immobili)
        if (chargeTenant && formData.target_type === 'real' && formData.target_id) {
            const { data: bookings } = await supabase
                .from('bookings')
                .select('id, nome_ospite')
                .eq('property_id', formData.target_id)
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
                    tipo: 'altro', 
                    description: `Addebito: ${formData.description}`
                });
                toast({ title: "Addebito creato", description: `A carico di ${activeBooking.nome_ospite}` });
            }
        }

        // 3. Upload Documento
        if (attachment && expenseId) {
            const fileExt = attachment.name.split('.').pop();
            const fileName = `expense_${expenseId}_${Date.now()}.${fileExt}`;
            const { error: upError } = await supabase.storage.from('documents').upload(fileName, attachment);
            if (upError) throw upError;

            await supabase.from('documents').insert({
                user_id: user?.id,
                property_real_id: formData.target_type === 'real' ? formData.target_id : null,
                property_mobile_id: formData.target_type === 'mobile' ? formData.target_id : null,
                payment_id: expenseId,
                nome: `Ricevuta: ${formData.description}`,
                tipo: 'fattura',
                url: fileName
            });
        }

      } catch (error: any) { throw error; } finally { setUploading(false); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      toast({ title: editingId ? "Spesa aggiornata" : "Spesa salvata" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('payments').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: "Spesa eliminata" });
    }
  });

  return (
    <div className="space-y-6">
      {/* DIALOG ANTEPRIMA */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
            <div className="p-4 border-b bg-slate-50"><h3 className="font-bold">Anteprima</h3></div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4">
                {previewUrl && previewType === 'pdf' ? <iframe src={previewUrl} className="w-full h-full bg-white" /> : <img src={previewUrl || ''} className="max-h-full shadow-lg" />}
            </div>
        </DialogContent>
      </Dialog>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-gray-900">Spese Unificate</h1><p className="text-gray-500 text-sm">Gestione uscite Immobili e Veicoli</p></div>
        <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg border shadow-sm"><span className="text-sm text-gray-500 mr-2">Totale:</span><span className="text-xl font-bold text-red-600">- € {totalAmount.toFixed(2)}</span></div>
            <Button className="bg-blue-600" onClick={openNewExpense}><Plus className="w-4 h-4 mr-2" /> Nuova Spesa</Button>
        </div>
      </div>

       {/* FILTRI */}
       <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Tutti" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Tutti</SelectItem><SelectItem value="real">🏠 Immobili</SelectItem><SelectItem value="mobile">🚛 Veicoli</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Tutte" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutte</SelectItem>
                            <SelectItem value="manutenzione">Manutenzione</SelectItem>
                            <SelectItem value="bollette">Bollette</SelectItem>
                            <SelectItem value="carburante">Carburante</SelectItem>
                            <SelectItem value="tasse">Tasse</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Da Data</Label><Input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-white" /></div>
                <div className="space-y-1"><Label className="text-xs">A Data</Label><Input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-white" /></div>
                <Button variant="outline" onClick={resetFilters}><X className="w-4 h-4 mr-2" /> Reset</Button>
            </div>
        </CardContent>
      </Card>

      {/* DIALOG EDIT / NEW */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Modifica Spesa' : 'Registra Nuova Spesa'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              
              {/* SELETTORE TIPO OGGETTO */}
              <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer flex items-center justify-center gap-2 ${formData.target_type === 'real' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                    onClick={() => setFormData({...formData, target_type: 'real', target_id: ''})}
                  >
                    <Home className="w-5 h-5"/> Immobile
                  </div>
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer flex items-center justify-center gap-2 ${formData.target_type === 'mobile' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                    onClick={() => setFormData({...formData, target_type: 'mobile', target_id: ''})}
                  >
                    <Car className="w-5 h-5"/> Veicolo
                  </div>
              </div>

              <div className="grid gap-2">
                <Label>Seleziona {formData.target_type === 'real' ? 'Immobile' : 'Mezzo'}</Label>
                <Select value={formData.target_id} onValueChange={(v) => setFormData({...formData, target_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {formData.target_type === 'real' 
                        ? properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))
                        : vehicles?.map((v) => (<SelectItem key={v.id} value={v.id}>{v.veicolo || v.nome || v.targa}</SelectItem>))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutenzione">Manutenzione</SelectItem>
                    <SelectItem value="bollette">Utenze/Bollette</SelectItem>
                    <SelectItem value="carburante">Carburante</SelectItem>
                    <SelectItem value="tasse">Tasse/Assicurazione</SelectItem>
                    <SelectItem value="condominio">Condominio</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Importo (€)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Data</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
              </div>

              {formData.target_type === 'real' && (
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div className="space-y-0.5"><Label className="text-blue-900 font-bold flex items-center gap-2"><User className="w-4 h-4"/> Addebita a Inquilino?</Label></div>
                      <Switch checked={chargeTenant} onCheckedChange={setChargeTenant} />
                  </div>
              )}

              <div className="grid gap-2"><Label>Descrizione</Label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              
              <div className="grid gap-2 border p-3 rounded-md bg-slate-50 border-dashed border-slate-300">
                <Label className="flex items-center gap-2 cursor-pointer"><Paperclip className="w-4 h-4 text-blue-600" /> Allegato</Label>
                <Input type="file" className="bg-white" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
              </div>

              <Button className="w-full bg-blue-600" onClick={() => saveExpense.mutate()} disabled={!formData.target_id || !formData.amount || uploading}>
                  {uploading ? "Salvataggio..." : (editingId ? "Aggiorna Spesa" : "Salva Spesa")}
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      {/* TABELLA */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Doc</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center p-8 text-gray-400">Nessuna spesa trovata.</TableCell></TableRow>
              ) : (
                expenses.map((ex: any) => (
                <TableRow key={ex.id}>
                  <TableCell className="w-[100px]">{ex.scadenza ? format(new Date(ex.scadenza), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="font-medium">
                      {ex.properties_mobile ? (
                          <span className="flex items-center gap-2 text-slate-700"><Car className="w-4 h-4 text-blue-500"/> {ex.properties_mobile.veicolo || ex.properties_mobile.nome}</span>
                      ) : (
                          <span className="flex items-center gap-2 text-slate-700"><Home className="w-4 h-4 text-orange-500"/> {ex.properties_real?.nome || 'Generale'}</span>
                      )}
                  </TableCell>
                  <TableCell><span className="capitalize bg-slate-100 px-2 py-1 rounded text-xs">{ex.categoria}</span></TableCell>
                  <TableCell className="max-w-[200px] truncate">{ex.descrizione}</TableCell>
                  <TableCell className="font-bold text-red-600">- €{parseFloat(ex.importo).toFixed(2)}</TableCell>
                  <TableCell>
                    {ex.documents && ex.documents.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(ex.documents[0])}><Eye className="w-4 h-4 text-blue-600" /></Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditExpense(ex)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { if(confirm("Eliminare?")) deleteExpense.mutate(ex.id) }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}