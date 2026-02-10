import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, User, Car, Home, Ticket, Euro, CreditCard, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // --- STATI PER I FILTRI ---
  const [filterType, setFilterType] = useState('all'); // all, real, mobile
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // yyyy-MM
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    targetType: 'real' as 'real' | 'mobile',
    targetId: '',
    importo: '',
    descrizione: '',
    categoria: 'manutenzione',
    scadenza: format(new Date(), 'yyyy-MM-dd'),
    stato: 'da_pagare',
    competence: 'owner' as 'owner' | 'tenant',
    payment_method: 'da definire'
  });

  const { data: realProperties = [] } = usePropertiesReal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: mobileProperties = [] } = useQuery({
    queryKey: ['mobile-properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa').eq('status', 'active');
      return data || [];
    }
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['unified-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`*, properties_real(nome), properties_mobile(veicolo, targa), tickets(titolo)`)
        .order('scadenza', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const saveExpense = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload: any = {
        importo: parseFloat(formData.importo),
        importo_originale: parseFloat(formData.importo),
        descrizione: formData.descrizione,
        categoria: formData.categoria,
        scadenza: formData.scadenza,
        stato: formData.stato,
        competence: formData.competence,
        payment_method: formData.payment_method,
        user_id: user?.id,
        property_real_id: formData.targetType === 'real' ? formData.targetId : null,
        property_mobile_id: formData.targetType === 'mobile' ? formData.targetId : null
      };

      if (editingId) {
        const { error } = await supabase.from('payments').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
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

  const openEdit = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
        targetType: expense.property_mobile_id ? 'mobile' : 'real',
        targetId: expense.property_mobile_id || expense.property_real_id || '',
        importo: expense.importo.toString(),
        descrizione: expense.descrizione || '',
        categoria: expense.categoria || 'manutenzione',
        scadenza: expense.scadenza,
        stato: expense.stato || 'da_pagare',
        competence: expense.competence || 'owner',
        payment_method: expense.payment_method || 'da definire'
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
        categoria: 'manutenzione', scadenza: format(new Date(), 'yyyy-MM-dd'), 
        stato: 'da_pagare', competence: 'owner', payment_method: 'da definire'
    });
  };

  // --- LOGICA FILTRI E PAGINAZIONE ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter((ex: any) => {
      // 1. Filtro Tipo (Immobile/Veicolo)
      if (filterType === 'real' && !ex.property_real_id) return false;
      if (filterType === 'mobile' && !ex.property_mobile_id) return false;

      // 2. Filtro Testo POTENZIATO (Cerca anche nel nome proprietà/veicolo)
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesDesc = ex.descrizione?.toLowerCase().includes(lowerSearch);
        const matchesCat = ex.categoria?.toLowerCase().includes(lowerSearch);
        const matchesAmount = ex.importo.toString().includes(lowerSearch);
        
        // Nuova ricerca per proprietà
        const matchesPropReal = ex.properties_real?.nome?.toLowerCase().includes(lowerSearch);
        const matchesPropMobile = ex.properties_mobile?.veicolo?.toLowerCase().includes(lowerSearch) || 
                                  ex.properties_mobile?.targa?.toLowerCase().includes(lowerSearch);

        if (!matchesDesc && !matchesCat && !matchesAmount && !matchesPropReal && !matchesPropMobile) {
            return false;
        }
      }

      // 3. Filtro Mese
      if (selectedMonth) {
        const exDate = ex.scadenza ? ex.scadenza.substring(0, 7) : '';
        if (exDate !== selectedMonth) return false;
      }

      return true;
    });
  }, [expenses, filterType, searchTerm, selectedMonth]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + parseFloat(curr.importo || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in pb-20"> 
      
      {/* HEADER E KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestione Spese</h1>
          <p className="text-gray-500 text-sm">Uscite immobili e veicoli</p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full md:w-auto">
            {/* KPI Totale Filtrato */}
            <div className="text-right bg-red-50 px-3 py-1 rounded-lg border border-red-100 w-full sm:w-auto">
                <p className="text-[10px] text-red-500 uppercase font-bold tracking-wider">Totale Filtrato</p>
                <p className="text-lg font-bold text-red-700">- € {totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
            
            <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Nuova Spesa
            </Button>
        </div>
      </div>

      {/* --- BARRA FILTRI --- */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3 flex flex-wrap gap-3 items-end">
            
            {/* Ricerca */}
            <div className="grid gap-1 min-w-[200px] flex-1">
                <Label className="text-xs font-semibold text-slate-500">Cerca</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400"/>
                    <Input className="pl-9 h-9 bg-white text-sm" placeholder="Descrizione, proprietà, targa..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                </div>
            </div>

            {/* Filtro Mese */}
            <div className="grid gap-1 w-full sm:w-[140px]">
                <Label className="text-xs font-semibold text-slate-500">Mese</Label>
                <Input type="month" className="h-9 bg-white text-sm" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setCurrentPage(1); }} />
            </div>

            {/* Toggle Tipo */}
            <div className="flex bg-white p-1 rounded-md border shadow-sm h-9 w-full sm:w-auto">
                <Button variant={filterType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilterType('all'); setCurrentPage(1); }} className="flex-1 px-3 text-xs">Tutti</Button>
                <Button variant={filterType === 'real' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilterType('real'); setCurrentPage(1); }} className="flex-1 px-3 text-xs"><Home className="w-3 h-3"/></Button>
                <Button variant={filterType === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilterType('mobile'); setCurrentPage(1); }} className="flex-1 px-3 text-xs"><Car className="w-3 h-3"/></Button>
            </div>

            {/* Reset */}
            <Button variant="outline" size="sm" className="h-9 text-xs w-full sm:w-auto" onClick={() => { setSearchTerm(''); setSelectedMonth(''); setFilterType('all'); setCurrentPage(1); }}>
                Reset
            </Button>
        </CardContent>
      </Card>

      {/* TABELLA DATI */}
      <Card className="border-t-4 border-t-blue-500 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px] whitespace-nowrap">Scadenza</TableHead>
                  <TableHead className="min-w-[140px] whitespace-nowrap">Riferimento</TableHead>
                  <TableHead className="min-w-[200px]">Descrizione</TableHead>
                  <TableHead className="hidden md:table-cell whitespace-nowrap">Metodo</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Importo</TableHead>
                  <TableHead className="text-right w-[90px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                     <TableRow><TableCell colSpan={6} className="text-center py-8">Caricamento...</TableCell></TableRow>
                ) : paginatedExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Nessuna spesa trovata.</TableCell></TableRow>
                ) : (
                  paginatedExpenses.map((ex: any) => (
                    <TableRow key={ex.id} className="hover:bg-slate-50 group transition-colors">
                      <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                          {ex.scadenza ? format(new Date(ex.scadenza), 'dd MMM yy', { locale: it }) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                          {ex.properties_mobile ? (
                              <div className="flex items-center gap-2 text-slate-700">
                                  <span className="bg-indigo-100 text-indigo-700 p-1 rounded shrink-0"><Car className="w-3 h-3"/></span>
                                  <div className="min-w-0">
                                      <p className="text-xs font-bold leading-none truncate max-w-[100px]">{ex.properties_mobile.veicolo}</p>
                                      <p className="text-[10px] text-gray-400 leading-none truncate">{ex.properties_mobile.targa}</p>
                                  </div>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 text-slate-700">
                                  <span className="bg-orange-100 text-orange-700 p-1 rounded shrink-0"><Home className="w-3 h-3"/></span>
                                  <span className="text-xs font-bold truncate max-w-[120px]">{ex.properties_real?.nome || 'Generale'}</span>
                              </div>
                          )}
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-1">
                                  <span className="capitalize bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200 whitespace-nowrap">
                                      {ex.categoria}
                                  </span>
                                  {ex.ticket_id && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-1 border-blue-200 text-blue-600 bg-blue-50 whitespace-nowrap">
                                          <Ticket className="w-3 h-3"/> Ticket
                                      </Badge>
                                  )}
                                  {ex.competence === 'tenant' && (
                                      <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 whitespace-nowrap">
                                          <User className="w-3 h-3 mr-1"/> Inquilino
                                      </Badge>
                                  )}
                              </div>
                              <span className="text-sm text-slate-700 font-medium truncate max-w-[180px] md:max-w-[350px]" title={ex.descrizione}>{ex.descrizione}</span>
                          </div>
                      </TableCell>
                      
                      <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-gray-500 capitalize truncate block max-w-[100px]">{ex.payment_method || '-'}</span>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                          <div className="flex flex-col items-end">
                              <span className="font-bold text-red-600 font-mono text-sm">-€{parseFloat(ex.importo).toFixed(2)}</span>
                              <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase ${ex.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {ex.stato === 'pagato' ? 'PAGATO' : 'DA PAGARE'}
                              </span>
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
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
          </div>
          
          {/* PAGINAZIONE */}
          {filteredExpenses.length > 0 && (
            <div className="flex items-center justify-between p-3 border-t bg-slate-50">
                <p className="text-xs text-gray-500 pl-2">
                    Pagina {currentPage} di {totalPages}
                </p>
                <div className="flex gap-2 pr-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="w-3 h-3 mr-1"/> Indietro
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        Avanti <ChevronRight className="w-3 h-3 ml-1"/>
                    </Button>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG (MODALE PER NUOVA/MODIFICA SPESA) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Spesa' : 'Registra Nuova Spesa'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4"/> Metodo</Label>
                    <Select value={formData.payment_method} onValueChange={(v) => setFormData({...formData, payment_method: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="da definire">Da Definire</SelectItem>
                            <SelectItem value="bonifico">Bonifico</SelectItem>
                            <SelectItem value="carta">Carta/Bancomat</SelectItem>
                            <SelectItem value="contanti">Contanti</SelectItem>
                            <SelectItem value="rid">RID / Addebito</SelectItem>
                            <SelectItem value="assegno">Assegno</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><User className="w-4 h-4 text-purple-600"/> A carico di</Label>
                    <Select value={formData.competence} onValueChange={(v: 'owner'|'tenant') => setFormData({...formData, competence: v})}>
                        <SelectTrigger className={formData.competence === 'tenant' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="owner">🏠 Proprietario</SelectItem>
                            <SelectItem value="tenant">👤 Inquilino</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2"> 
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Annulla</Button>
            <Button onClick={() => saveExpense.mutate()} disabled={!formData.importo || !formData.targetId} className="w-full sm:w-auto">
                {editingId ? 'Salva Modifiche' : 'Aggiungi Spesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}