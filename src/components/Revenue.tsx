import React, { useState } from 'react';
import { useRevenue } from '@/hooks/useRevenue';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { TrendingUp, Plus, DollarSign, Calendar as CalendarIcon, Trash2, CheckCircle, AlertCircle, RefreshCw, CalendarPlus } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function Revenue() {
  const { revenues, createPaymentPlan, markAsPaid, deletePayment, isLoading } = useRevenue();
  const { data: properties } = usePropertiesReal();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // FORM STATE
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

  const today = new Date().toISOString().split('T')[0];
  
  const { data: activeTenants } = useQuery({
    queryKey: ['active-tenants', selectedProp],
    queryFn: async () => {
        console.log("selectedProp", selectedProp);
        if (!selectedProp) return [];

        // 1. Get today's date in ISO format
        const today = new Date().toISOString(); 

        const { data } = await supabase
            .from('bookings')
            .select('id, nome_ospite, tipo_affitto')
            .eq('property_id', selectedProp)
            // 2. Add the Date Filters
            .lte('data_inizio', today)  // Started in the past (or today)
            .gte('data_fine', today);   // Ends in the future (or today)

        return data || [];
    },
    enabled: !!selectedProp
  });

  const handleSubmit = async () => {
    if (!formData.amount || !formData.booking_id) return;
    
    await createPaymentPlan.mutateAsync({
      booking_id: formData.booking_id,
      amount: parseFloat(formData.amount),
      date_start: new Date(formData.date_start),
      category: formData.category,
      description: formData.description || 'Rata canone',
      is_recurring: formData.is_recurring,
      months: parseInt(formData.months)
    });
    
    setIsDialogOpen(false);
    setFormData({ ...formData, amount: '', description: '' });
  };

  // Funzione Export Calendario (.ics)
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

  // CALCOLO KPI
  const totalCollected = revenues?.filter(r => r.stato === 'pagato').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;
  const totalPending = revenues?.filter(r => r.stato === 'da_pagare').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Incassi & Piani</h1>
            <p className="text-gray-500">Gestisci i flussi di cassa e le morosità.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Nuovo Incasso
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Registra Entrata / Piano</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Proprietà</Label>
                    <Select onValueChange={(v) => setSelectedProp(v)}>
                      <SelectTrigger><SelectValue placeholder="Scegli casa..." /></SelectTrigger>
                      <SelectContent>
                        {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Inquilino</Label>
                    <Select onValueChange={(v) => setFormData({...formData, booking_id: v})} disabled={!selectedProp}>
                      <SelectTrigger><SelectValue placeholder={!selectedProp ? "Prima la casa" : "Seleziona..."} /></SelectTrigger>
                      <SelectContent>
                        {activeTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.nome_ospite}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                 </div>
                 <div className="grid gap-2">
                    <Label>Data Scadenza</Label>
                    <Input type="date" value={formData.date_start} onChange={e => setFormData({...formData, date_start: e.target.value})} />
                 </div>
              </div>

              <div className="grid gap-2">
                <Label>Categoria Fiscale</Label>
                <Select onValueChange={(v) => setFormData({...formData, category: v})} defaultValue="canone_locazione">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canone_locazione">🏠 Canone Locazione (Reddito)</SelectItem>
                    <SelectItem value="rimborso_utenze">💡 Rimborso Utenze (Giroconto)</SelectItem>
                    <SelectItem value="deposito_cauzionale">🔒 Deposito Cauzionale (Debito)</SelectItem>
                    <SelectItem value="extra">⭐ Extra / Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 cursor-pointer">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                          Genera Piano Rateale
                      </Label>
                      <Switch checked={formData.is_recurring} onCheckedChange={(c) => setFormData({...formData, is_recurring: c})} />
                  </div>
                  
                  {formData.is_recurring && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                          <Label className="text-xs text-gray-500 mb-1 block">Numero di rate mensili</Label>
                          <Input 
                            type="number" 
                            value={formData.months} 
                            onChange={e => setFormData({...formData, months: e.target.value})} 
                            className="bg-white"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Verranno create {formData.months} scadenze future.</p>
                      </div>
                  )}
              </div>

              <div className="grid gap-2">
                <Label>Note / Descrizione</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es. Affitto Maggio o Note particolari" />
              </div>
              
              <Button onClick={handleSubmit} className="w-full bg-green-600 hover:bg-green-700 font-bold">
                  {formData.is_recurring ? `Genera Piano (${formData.months} Rate)` : 'Registra Incasso Singolo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-green-100 rounded-full text-green-700"><CheckCircle className="w-8 h-8" /></div>
            <div>
                <p className="text-sm text-green-700 font-medium uppercase tracking-wider">Incassato (Reale)</p>
                <h2 className="text-3xl font-bold text-green-900">€ {totalCollected.toLocaleString()}</h2>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-orange-100 rounded-full text-orange-700"><CalendarIcon className="w-8 h-8" /></div>
            <div>
                <p className="text-sm text-orange-700 font-medium uppercase tracking-wider">In Attesa / Previsto</p>
                <h2 className="text-3xl font-bold text-orange-900">€ {totalPending.toLocaleString()}</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Flusso di Cassa</CardTitle></CardHeader>
        <CardContent>
            <div className="space-y-1">
                {isLoading ? <p className="p-4 text-center">Caricamento...</p> : revenues?.map((rev) => {
                    const isOverdue = rev.stato === 'da_pagare' && isPast(new Date(rev.data_scadenza)) && !isToday(new Date(rev.data_scadenza));
                    
                    return (
                    <div key={rev.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-start gap-4 mb-2 md:mb-0 w-full md:w-1/3">
                            <div className={`p-2 rounded-full mt-1 ${rev.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-900">{rev.bookings?.nome_ospite || 'N/A'}</p>
                                    <span className="text-xs text-gray-400 bg-white border px-1 rounded">{rev.bookings?.properties_real?.nome}</span>
                                </div>
                                <p className="text-sm text-gray-500 capitalize">
                                    {rev.category?.replace('_', ' ') || 'Generico'}
                                </p>
                                {/* VISUALIZZAZIONE NOTE INTEGRATA */}
                                {(rev.notes || rev.description) && (
                                  <p className="text-xs text-blue-600 mt-1 italic border-l-2 border-blue-200 pl-2">
                                    "{rev.notes || rev.description}"
                                  </p>
                                )}
                                {isOverdue && <Badge variant="destructive" className="mt-1 h-5 text-[10px]">SCADUTO</Badge>}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 justify-between w-full md:w-auto mt-2 md:mt-0">
                             {/* EXPORT CALENDARIO */}
                             <Button variant="outline" size="icon" className="h-8 w-8 text-blue-500 border-blue-200 hover:bg-blue-50" onClick={() => downloadIcs(rev)} title="Aggiungi al Calendario">
                                <CalendarPlus className="w-4 h-4" />
                             </Button>

                            <div className="text-right min-w-[100px]">
                                <p className={`font-bold ${rev.stato === 'pagato' ? 'text-green-600' : 'text-slate-600'}`}>€{rev.importo}</p>
                                <p className="text-xs text-gray-400">Scad: {format(new Date(rev.data_scadenza), 'dd MMM yyyy')}</p>
                            </div>
                            
                            <div className="flex gap-1">
                                {rev.stato !== 'pagato' ? (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => markAsPaid.mutate(rev.id)}>
                                        Incassa
                                    </Button>
                                ) : (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 h-8 px-3">Pagato</Badge>
                                )}
                                
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