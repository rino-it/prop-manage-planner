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
import { Plus, Trash2, Pencil, User, Car, Home, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: realProperties } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- STATI LOCALI ---
  const [targetType, setTargetType] = useState<'real' | 'mobile'>('real'); // Switch tra Casa e Veicolo
  
  // --- FILTRI ---
  const [filterType, setFilterType] = useState('all'); // 'real', 'mobile', 'all'
  const [filterCategory, setFilterCategory] = useState("all");
  
  const [formData, setFormData] = useState({
    target_id: '',
    category: 'manutenzione',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'bonifico'
  });

  // --- QUERY: CARICA I VEICOLI (Per il dropdown) ---
  const { data: mobileProperties } = useQuery({
    queryKey: ['mobile-properties-list'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, nome, targa');
      return data || [];
    }
  });

  // --- QUERY: CARICA LE SPESE (Dalla tabella 'payments') ---
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['unified-expenses', filterType, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          *,
          properties_real (nome),
          properties_mobile (nome, targa)
        `)
        .order('scadenza', { ascending: false });
      
      // Filtri lato DB
      if (filterCategory !== "all") query = query.eq('categoria', filterCategory);
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

  // --- SALVATAGGIO (Inserimento in 'payments') ---
  const createExpense = useMutation({
    mutationFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Payload dinamico in base al tipo (Casa o Veicolo)
        const payload = {
            user_id: user?.id,
            property_real_id: targetType === 'real' ? formData.target_id : null,
            property_mobile_id: targetType === 'mobile' ? formData.target_id : null,
            categoria: formData.category,
            importo: parseFloat(formData.amount),
            importo_originale: parseFloat(formData.amount), // Richiesto dal DB
            descrizione: formData.description,
            scadenza: formData.date,
            stato: 'pagato', // Default
            metodo_pagamento: formData.payment_method,
            ricorrenza_tipo: 'mensile' // Default obbligatorio per not null
        };

        const { error } = await supabase.from('payments').insert(payload);
        if (error) throw error;

      } catch (error: any) { throw error; }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      setIsDialogOpen(false);
      setFormData({ ...formData, amount: '', description: '' }); // Reset parziale
      toast({ title: "Spesa registrata", description: "Visibile in Dashboard e Contabilità." });
    },
    onError: (err: any) => toast({ title: "Errore inserimento", description: err.message, variant: "destructive" })
  });

  // --- CANCELLAZIONE ---
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('payments').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      toast({ title: "Spesa eliminata" });
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Gestione Spese</h1>
           <p className="text-gray-500 text-sm">Monitoraggio costi Immobili e Flotta</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                <span className="text-sm text-gray-500 mr-2">Totale Uscite:</span>
                <span className="text-xl font-bold text-red-600">- € {totalAmount.toFixed(2)}</span>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nuova Uscita
            </Button>
        </div>
      </div>

       {/* FILTRI */}
       <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                    <Label className="text-xs">Filtra per Tipo</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti</SelectItem>
                            <SelectItem value="real">🏠 Immobili</SelectItem>
                            <SelectItem value="mobile">🚛 Veicoli</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Tutte" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutte</SelectItem>
                            <SelectItem value="manutenzione">Manutenzione</SelectItem>
                            <SelectItem value="carburante">Carburante</SelectItem>
                            <SelectItem value="bollette">Bollette/Utenze</SelectItem>
                            <SelectItem value="tasse">Tasse/Assicurazione</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" onClick={() => {setFilterType('all'); setFilterCategory('all')}} className="text-slate-500">
                    <X className="w-4 h-4 mr-2" /> Reset Filtri
                </Button>
            </div>
        </CardContent>
      </Card>

      {/* DIALOG NUOVA SPESA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Registra Nuova Spesa</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-2">
              
              {/* SWITCH TIPO */}
              <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button 
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${targetType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    onClick={() => { setTargetType('real'); setFormData({...formData, target_id: ''}); }}
                  >
                    <Home className="w-4 h-4"/> Immobile
                  </button>
                  <button 
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${targetType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    onClick={() => { setTargetType('mobile'); setFormData({...formData, target_id: ''}); }}
                  >
                    <Car className="w-4 h-4"/> Veicolo
                  </button>
              </div>

              {/* SELEZIONE OGGETTO */}
              <div className="grid gap-2">
                <Label>Seleziona {targetType === 'real' ? 'Proprietà' : 'Mezzo'}</Label>
                <Select value={formData.target_id} onValueChange={(v) => setFormData({...formData, target_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {targetType === 'real' 
                        ? realProperties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))
                        : mobileProperties?.map((m) => (<SelectItem key={m.id} value={m.id}>{m.nome} ({m.targa})</SelectItem>))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* DETTAGLI */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="manutenzione">Manutenzione</SelectItem>
                            {targetType === 'mobile' && <SelectItem value="carburante">Carburante</SelectItem>}
                            {targetType === 'mobile' && <SelectItem value="pedaggio">Pedaggio</SelectItem>}
                            <SelectItem value="bollette">Utenze</SelectItem>
                            <SelectItem value="tasse">Tasse/Assic.</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Metodo</Label>
                    <Select value={formData.payment_method} onValueChange={(v) => setFormData({...formData, payment_method: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bonifico">Bonifico</SelectItem>
                            <SelectItem value="carta">Carta Aziendale</SelectItem>
                            <SelectItem value="contanti">Contanti</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Importo (€)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Data</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
              </div>

              <div className="grid gap-2"><Label>Descrizione</Label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es. Riparazione gomma, Bolletta Enel..." /></div>
              
              <Button className="w-full bg-red-600 hover:bg-red-700 font-bold" onClick={() => createExpense.mutate()} disabled={!formData.target_id || !formData.amount}>
                  Salva Spesa
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      {/* TABELLA UNIFICATA */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Riferimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-gray-400">Nessuna spesa trovata.</TableCell></TableRow>
              ) : (
                expenses.map((ex: any) => (
                <TableRow key={ex.id}>
                  <TableCell className="font-mono text-xs">{ex.scadenza ? format(new Date(ex.scadenza), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="font-medium">
                      {ex.properties_mobile ? (
                          <span className="flex items-center gap-2 text-slate-700"><Car className="w-4 h-4 text-blue-500"/> {ex.properties_mobile.nome} <span className="text-xs text-gray-400">({ex.properties_mobile.targa})</span></span>
                      ) : (
                          <span className="flex items-center gap-2 text-slate-700"><Home className="w-4 h-4 text-orange-500"/> {ex.properties_real?.nome || 'Generale'}</span>
                      )}
                  </TableCell>
                  <TableCell><span className="capitalize bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{ex.categoria}</span></TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-600">{ex.descrizione}</TableCell>
                  <TableCell className="font-bold text-red-600">- €{parseFloat(ex.importo).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => { if(confirm("Eliminare questa spesa?")) deleteExpense.mutate(ex.id) }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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