import React, { useState } from 'react';
import { useRevenue } from '@/hooks/useRevenue';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DollarSign, Calendar as CalendarIcon, Trash2, CheckCircle, RefreshCw, CalendarPlus, Pencil, Plus } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function Revenue() {
  const { revenues, createPaymentPlan, markAsPaid, deletePayment, isLoading } = useRevenue();
  const { data: properties } = usePropertiesReal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // STATI
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // ID dell'incasso in modifica

  // FORM DATA
  const [selectedProp, setSelectedProp] = useState('');
  const [formData, setFormData] = useState({
    booking_id: '',
    amount: '',
    date_start: format(new Date(), 'yyyy-MM-dd'),
    category: 'canone_locazione',
    description: '',
    is_recurring: false,
    months: '12'
  });

  // FETCH INQUILINI ATTIVI (Per il form di creazione)
  const { data: activeTenants } = useQuery({
    queryKey: ['active-tenants', selectedProp],
    queryFn: async () => {
        if (!selectedProp) return [];
        const todayISO = new Date().toISOString(); 
        const { data } = await supabase
            .from('bookings')
            .select('id, nome_ospite')
            .eq('property_id', selectedProp)
            .lte('data_inizio', todayISO)
            .gte('data_fine', todayISO);
        return data || [];
    },
    enabled: !!selectedProp
  });

  // MUTATION: AGGIORNA INCASSO ESISTENTE
  const updateRevenue = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase
        .from('tenant_payments')
        .update({
          importo: parseFloat(formData.amount),
          data_scadenza: formData.date_start,
          category: formData.category,
          description: formData.description || ''
        })
        .eq('id', editingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: "Incasso Aggiornato", description: "Data e importo modificati con successo." });
      handleCloseDialog();
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  // GESTIONE SAVE (Crea o Aggiorna)
  const handleSubmit = async () => {
    if (!formData.amount) return;

    if (editingId) {
      // MODIFICA
      updateRevenue.mutate();
    } else {
      // CREAZIONE
      if (!formData.booking_id) {
        toast({ title: "Seleziona un inquilino", variant: "destructive" });
        return;
      }
      await createPaymentPlan.mutateAsync({
        booking_id: formData.booking_id,
        amount: parseFloat(formData.amount),
        date_start: new Date(formData.date_start),
        category: formData.category,
        description: formData.description || 'Rata canone',
        is_recurring: formData.is_recurring,
        months: parseInt(formData.months)
      });
      handleCloseDialog();
    }
  };

  // APRE IL DIALOG IN MODALITÀ MODIFICA
  const handleEdit = (rev: any) => {
    setEditingId(rev.id);
    
    // Precompila il form
    setFormData({
      booking_id: rev.booking_id || '', 
      amount: rev.importo.toString(),
      date_start: rev.data_scadenza, // La data attuale dal DB
      category: rev.category || 'canone_locazione',
      description: rev.description || rev.notes || '',
      is_recurring: false, // Disabilita ricorrenza in modifica
      months: '1'
    });
    
    // Imposta la proprietà per visualizzazione (opzionale)
    if (rev.bookings?.property_id) setSelectedProp(rev.bookings.property_id);
    
    setIsDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      booking_id: '', amount: '', date_start: format(new Date(), 'yyyy-MM-dd'),
      category: 'canone_locazione', description: '', is_recurring: false, months: '12'
    });
    setSelectedProp('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  // Export Calendario
  const downloadIcs = (p: any) => {
    const text = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `SUMMARY:Incasso ${p.bookings?.nome_ospite || 'Affitto'}`,
      `DESCRIPTION:${p.notes || p.description || ''}`,
      `DTSTART;VALUE=DATE:${p.data_scadenza.replace(/-/g, '')}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: 'text/calendar'}));
    a.download = `scadenza_${p.data_scadenza}.ics`; a.click();
  };

  // Calcolo Totali
  const totalCollected = revenues?.filter(r => r.stato === 'pagato').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;
  const totalPending = revenues?.filter(r => r.stato === 'da_pagare').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Incassi & Piani</h1>
            <p className="text-gray-500">Gestisci i flussi di cassa e le date di scadenza.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={handleOpenCreate} className="bg-green-600 hover:bg-green-700 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Nuovo Incasso
          </Button>
          
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Scadenza / Importo' : 'Registra Nuova Entrata'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              
              {/* SELEZIONE PROPRIETÀ/INQUILINO (Disabilitata in Edit) */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Proprietà</Label>
                    <Select onValueChange={setSelectedProp} value={selectedProp} disabled={!!editingId}>
                      <SelectTrigger><SelectValue placeholder="Scegli casa..." /></SelectTrigger>
                      <SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Inquilino</Label>
                    <Select onValueChange={(v) => setFormData({...formData, booking_id: v})} value={formData.booking_id} disabled={!selectedProp || !!editingId}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
                 <div className="grid gap-2">
                    <Label>Data Scadenza</Label>
                    <Input type="date" value={formData.date_start} onChange={e => setFormData({...formData, date_start: e.target.value})} />
                 </div>
              </div>

              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => setFormData({...formData, category: v})} value={formData.category}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canone_locazione">🏠 Canone Locazione</SelectItem>
                    <SelectItem value="rimborso_utenze">💡 Rimborso Utenze</SelectItem>
                    <SelectItem value="deposito_cauzionale">🔒 Deposito Cauzionale</SelectItem>
                    <SelectItem value="extra">⭐ Extra / Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PIANO RATEALE (Solo in creazione) */}
              {!editingId && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer"><RefreshCw className="w-4 h-4 text-blue-600" /> Genera Piano Rateale</Label>
                        <Switch checked={formData.is_recurring} onCheckedChange={(c) => setFormData({...formData, is_recurring: c})} />
                    </div>
                    {formData.is_recurring && (
                        <div className="pt-2"><Label className="text-xs text-gray-500 mb-1">Numero rate mensili</Label><Input type="number" value={formData.months} onChange={e => setFormData({...formData, months: e.target.value})} className="bg-white"/></div>
                    )}
                </div>
              )}

              <div className="grid gap-2">
                <Label>Note</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es. Affitto Maggio" />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Annulla</Button>
                <Button onClick={handleSubmit} className={`font-bold ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
                    {editingId ? 'Salva Modifiche' : 'Registra'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-green-100 rounded-full text-green-700"><CheckCircle className="w-8 h-8" /></div>
            <div><p className="text-sm text-green-700 font-medium uppercase">Incassato</p><h2 className="text-3xl font-bold text-green-900">€ {totalCollected.toLocaleString()}</h2></div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-orange-100 rounded-full text-orange-700"><CalendarIcon className="w-8 h-8" /></div>
            <div><p className="text-sm text-orange-700 font-medium uppercase">In Attesa</p><h2 className="text-3xl font-bold text-orange-900">€ {totalPending.toLocaleString()}</h2></div>
          </CardContent>
        </Card>
      </div>

      {/* TABELLA */}
      <Card>
        <CardHeader><CardTitle>Storico Incassi</CardTitle></CardHeader>
        <CardContent>
            <div className="space-y-1">
                {isLoading ? <p className="p-4 text-center">Caricamento...</p> : revenues?.map((rev) => {
                    const isOverdue = rev.stato === 'da_pagare' && isPast(new Date(rev.data_scadenza)) && !isToday(new Date(rev.data_scadenza));
                    return (
                    <div key={rev.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-start gap-4 mb-2 md:mb-0 w-full md:w-1/3">
                            <div className={`p-2 rounded-full mt-1 ${rev.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}><DollarSign className="w-5 h-5" /></div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-900">{rev.bookings?.nome_ospite || 'N/A'}</p>
                                    <span className="text-xs text-gray-400 bg-white border px-1 rounded">{rev.bookings?.properties_real?.nome}</span>
                                </div>
                                <p className="text-sm text-gray-500 capitalize">{rev.category?.replace('_', ' ') || 'Generico'}</p>
                                {(rev.notes || rev.description) && <p className="text-xs text-blue-600 mt-1 italic">"{rev.notes || rev.description}"</p>}
                                {isOverdue && <Badge variant="destructive" className="mt-1 h-5 text-[10px]">SCADUTO</Badge>}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 justify-between w-full md:w-auto mt-2 md:mt-0">
                             <Button variant="outline" size="icon" className="h-8 w-8 text-blue-500 border-blue-200 hover:bg-blue-50" onClick={() => downloadIcs(rev)}><CalendarPlus className="w-4 h-4" /></Button>

                            <div className="text-right min-w-[100px]">
                                <p className={`font-bold ${rev.stato === 'pagato' ? 'text-green-600' : 'text-slate-600'}`}>€{rev.importo}</p>
                                <p className="text-xs text-gray-400">Scad: {format(new Date(rev.data_scadenza), 'dd MMM yyyy')}</p>
                            </div>
                            
                            <div className="flex gap-1">
                                {rev.stato !== 'pagato' ? (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => markAsPaid.mutate(rev.id)}>Incassa</Button>
                                ) : (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 h-8 px-3">Pagato</Badge>
                                )}
                                
                                {/* PULSANTE MODIFICA (NUOVO) */}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(rev)}>
                                    <Pencil className="w-4 h-4" />
                                </Button>

                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50" onClick={() => deletePayment.mutate(rev.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )})}
                {revenues?.length === 0 && <div className="text-center py-12 text-gray-400">Nessun movimento registrato.</div>}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}