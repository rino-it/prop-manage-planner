import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, User, Car, Home, Filter, X, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  // STATI
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Se null = Creazione, se string = Modifica
  const [filterType, setFilterType] = useState('all'); // Filtri Tabella

  // FORM DATA
  const [formData, setFormData] = useState({
    targetType: 'real' as 'real' | 'mobile',
    targetId: '',
    importo: '',
    descrizione: '',
    categoria: 'manutenzione',
    scadenza: format(new Date(), 'yyyy-MM-dd'),
    stato: 'da_pagare'
  });

  const { data: realProperties } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. FETCH VEICOLI (Inclusa Targa)
  const { data: mobileProperties } = useQuery({
    queryKey: ['mobile-properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa').eq('status', 'active');
      return data || [];
    }
  });

  // 2. FETCH SPESE (Unified)
  const { data: expenses = [] } = useQuery({
    queryKey: ['unified-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`*, properties_real(nome), properties_mobile(veicolo, targa)`)
        .order('scadenza', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // 3. MUTATION: SALVA (Upsert logic: Insert or Update)
  const saveExpense = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload: any = {
        importo: parseFloat(formData.importo),
        importo_originale: parseFloat(formData.importo), // Manteniamo consistenza
        descrizione: formData.descrizione,
        categoria: formData.categoria,
        scadenza: formData.scadenza,
        stato: formData.stato,
        user_id: user?.id,
        // Logica condizionale per le foreign key
        property_real_id: formData.targetType === 'real' ? formData.targetId : null,
        property_mobile_id: formData.targetType === 'mobile' ? formData.targetId : null
      };

      if (editingId) {
        // MODALITÀ MODIFICA
        const { error } = await supabase.from('payments').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        // MODALITÀ CREAZIONE
        const { error } = await supabase.from('payments').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Spesa Aggiornata" : "Spesa Creata" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  // 4. MUTATION: ELIMINA
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      toast({ title: "Spesa eliminata" });
    }
  });

  // HELPER: APRI MODAL PER EDIT
  const openEdit = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
        targetType: expense.property_mobile_id ? 'mobile' : 'real',
        targetId: expense.property_mobile_id || expense.property_real_id || '',
        importo: expense.importo.toString(),
        descrizione: expense.descrizione || '',
        categoria: expense.categoria || 'manutenzione',
        scadenza: expense.scadenza, // formato yyyy-mm-dd dal DB
        stato: expense.stato || 'da_pagare'
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
        targetType: 'real', targetId: '', importo: '', descrizione: '',
        categoria: 'manutenzione', scadenza: format(new Date(), 'yyyy-MM-dd'), stato: 'da_pagare'
    });
  };

  // LOGICA FILTRO (Preservata dalla tua versione)
  const filteredExpenses = expenses.filter((ex: any) => {
    if (filterType === 'all') return true;
    if (filterType === 'real') return !!ex.property_real_id;
    if (filterType === 'mobile') return !!ex.property_mobile_id;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* HEADER + FILTRI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Spese</h1>
          <p className="text-gray-500 text-sm">Registra uscite per immobili e veicoli</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <Button variant={filterType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')} className="text-xs">Tutti</Button>
            <Button variant={filterType === 'real' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('real')} className="text-xs flex gap-1"><Home className="w-3 h-3"/> Immobili</Button>
            <Button variant={filterType === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('mobile')} className="text-xs flex gap-1"><Car className="w-3 h-3"/> Veicoli</Button>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nuova Spesa
        </Button>
      </div>

      {/* TABELLA */}
      <Card className="border-t-4 border-t-blue-500 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Riferimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Nessuna spesa trovata.</TableCell></TableRow>
              ) : (
                filteredExpenses.map((ex: any) => (
                  <TableRow key={ex.id} className="hover:bg-slate-50 group transition-colors">
                    <TableCell className="font-mono text-xs text-slate-500">
                        {ex.scadenza ? format(new Date(ex.scadenza), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                        {ex.properties_mobile ? (
                            <div className="flex items-center gap-2 text-slate-700">
                                <span className="bg-indigo-100 text-indigo-700 p-1 rounded"><Car className="w-3 h-3"/></span>
                                <div>
                                    <p className="text-xs font-bold leading-none">{ex.properties_mobile.veicolo}</p>
                                    <p className="text-[10px] text-gray-400 leading-none">{ex.properties_mobile.targa}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-700">
                                <span className="bg-orange-100 text-orange-700 p-1 rounded"><Home className="w-3 h-3"/></span>
                                <span className="text-xs font-bold">{ex.properties_real?.nome || 'Generale'}</span>
                            </div>
                        )}
                    </TableCell>
                    <TableCell>
                        <span className="capitalize bg-slate-100 px-2 py-1 rounded text-xs text-slate-600 border border-slate-200">
                            {ex.categoria}
                        </span>
                        {/* Indicatore Stato Pagamento */}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold uppercase ${ex.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {ex.stato === 'pagato' ? 'PAGATO' : 'DA PAGARE'}
                        </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-600 text-sm">{ex.descrizione}</TableCell>
                    <TableCell className="font-bold text-red-600 text-right font-mono">-€{parseFloat(ex.importo).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(ex)}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => { if(confirm("Eliminare questa spesa?")) deleteExpense.mutate(ex.id) }}>
                                <Trash2 className="w-4 h-4" />
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

      {/* DIALOG UNIFICATO (CREAZIONE / MODIFICA) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Spesa' : 'Registra Nuova Spesa'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* SWITCHER TIPO */}
            <div className="flex items-center justify-center p-1 bg-slate-100 rounded-lg">
                <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${formData.targetType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    onClick={() => setFormData({...formData, targetType: 'real', targetId: ''})}
                >
                    <Home className="w-4 h-4"/> Immobile
                </button>
                <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${formData.targetType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    onClick={() => setFormData({...formData, targetType: 'mobile', targetId: ''})}
                >
                    <Car className="w-4 h-4"/> Veicolo
                </button>
            </div>

            {/* SELEZIONE OGGETTO */}
            <div className="grid gap-2">
                <Label>Seleziona {formData.targetType === 'real' ? 'Proprietà' : 'Mezzo'}</Label>
                <Select value={formData.targetId} onValueChange={(v) => setFormData({...formData, targetId: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                        {formData.targetType === 'real' 
                            ? realProperties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)
                            : mobileProperties?.map(m => <SelectItem key={m.id} value={m.id}>{m.veicolo} ({m.targa})</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>

            {/* DATI SPESA */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Importo (€)</Label>
                    <div className="relative">
                        <Euro className="absolute left-2 top-2.5 h-4 w-4 text-gray-400"/>
                        <Input type="number" className="pl-8" placeholder="0.00" value={formData.importo} onChange={e => setFormData({...formData, importo: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Scadenza</Label>
                    <Input type="date" value={formData.scadenza} onChange={e => setFormData({...formData, scadenza: e.target.value})} />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Descrizione</Label>
                <Input placeholder="Es. Bolletta Enel" value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.categoria} onValueChange={(v) => setFormData({...formData, categoria: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="manutenzione">Manutenzione</SelectItem>
                            <SelectItem value="utenze">Utenze</SelectItem>
                            <SelectItem value="tasse">Tasse</SelectItem>
                            <SelectItem value="assicurazione">Assicurazione</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Stato</Label>
                    <Select value={formData.stato} onValueChange={(v) => setFormData({...formData, stato: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="da_pagare">🔴 Da Pagare</SelectItem>
                            <SelectItem value="pagato">🟢 Pagato</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => saveExpense.mutate()} disabled={!formData.importo || !formData.targetId}>
                {editingId ? 'Salva Modifiche' : 'Aggiungi Spesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}