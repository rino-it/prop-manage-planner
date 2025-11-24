import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Plus, Zap, Droplet, Home, Euro, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    booking_id: '',
    tipo: 'affitto',
    importo: '',
    data_scadenza: undefined as Date | undefined,
    consumo_kw_mc: '',
    periodo_riferimento: ''
  });

  // 1. CARICA LE PRENOTAZIONI ATTIVE (Per sapere a chi assegnare la spesa)
  const { data: bookings } = useQuery({
    queryKey: ['active-bookings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id, nome_ospite, properties_real(nome)')
        .eq('tipo_affitto', 'lungo'); // Solo inquilini lungo termine
      return data;
    }
  });

  // 2. CARICA LE SPESE ESISTENTI
  const { data: payments, isLoading } = useQuery({
    queryKey: ['all-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payments')
        .select('*, bookings(nome_ospite, properties_real(nome))')
        .order('data_scadenza', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 3. SALVA NUOVA SPESA
  const createExpense = useMutation({
    mutationFn: async (newExpense: any) => {
      const { error } = await supabase.from('tenant_payments').insert(newExpense);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      setIsDialogOpen(false);
      toast({ title: "Spesa Registrata", description: "L'inquilino la vedrà nella sua dashboard." });
      setFormData({
        booking_id: '', tipo: 'affitto', importo: '', 
        data_scadenza: undefined, consumo_kw_mc: '', periodo_riferimento: ''
      });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // 4. CANCELLA SPESA
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenant_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      toast({ title: "Eliminata" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.booking_id || !formData.importo || !formData.data_scadenza) {
        toast({ title: "Dati mancanti", variant: "destructive" });
        return;
    }
    createExpense.mutate({
        booking_id: formData.booking_id,
        tipo: formData.tipo,
        importo: parseFloat(formData.importo),
        data_scadenza: format(formData.data_scadenza, 'yyyy-MM-dd'),
        consumo_kw_mc: formData.consumo_kw_mc ? parseFloat(formData.consumo_kw_mc) : null,
        periodo_riferimento: formData.periodo_riferimento,
        stato: 'da_pagare'
    });
  };

  const getIcon = (tipo: string) => {
    if (tipo === 'bolletta_luce') return <Zap className="w-4 h-4 text-yellow-600" />;
    if (tipo === 'bolletta_gas' || tipo === 'acqua') return <Droplet className="w-4 h-4 text-blue-600" />;
    if (tipo === 'affitto') return <Home className="w-4 h-4 text-purple-600" />;
    return <Euro className="w-4 h-4 text-gray-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Registro Spese & Affitti</h1>
            <p className="text-gray-500">Carica qui bollette e canoni per gli inquilini.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Aggiungi Spesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Nuova Spesa / Canone</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              
              <div className="grid gap-2">
                <Label>Inquilino / Contratto</Label>
                <Select onValueChange={(v) => setFormData({...formData, booking_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona inquilino..." /></SelectTrigger>
                  <SelectContent>
                    {bookings?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                            {b.nome_ospite} ({b.properties_real?.nome})
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select onValueChange={(v) => setFormData({...formData, tipo: v})} defaultValue="affitto">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="affitto">Canone Affitto</SelectItem>
                        <SelectItem value="bolletta_luce">⚡ Luce</SelectItem>
                        <SelectItem value="bolletta_gas">🔥 Gas</SelectItem>
                        <SelectItem value="acqua">💧 Acqua</SelectItem>
                        <SelectItem value="condominio">🏢 Condominio</SelectItem>
                        <SelectItem value="tari">🗑️ TARI / Rifiuti</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" required value={formData.importo} onChange={e => setFormData({...formData, importo: e.target.value})} placeholder="0.00" />
                </div>
              </div>

              <div className="grid gap-2">
                  <Label>Scadenza Pagamento</Label>
                  <Popover>
                    <PopoverTrigger asChild><Button variant={"outline"} className={cn(!formData.data_scadenza && "text-muted-foreground")}>{formData.data_scadenza ? format(formData.data_scadenza, "dd/MM/yyyy") : "Seleziona data"}</Button></PopoverTrigger>
                    <PopoverContent className="p-0"><Calendar mode="single" selected={formData.data_scadenza} onSelect={(d) => setFormData({...formData, data_scadenza: d})} /></PopoverContent>
                  </Popover>
              </div>

              {/* Campi Opzionali per Bollette */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                 <div className="grid gap-2">
                    <Label className="text-xs text-gray-500">Consumo (Kw/Mc)</Label>
                    <Input type="number" value={formData.consumo_kw_mc} onChange={e => setFormData({...formData, consumo_kw_mc: e.target.value})} placeholder="Es. 150" />
                 </div>
                 <div className="grid gap-2">
                    <Label className="text-xs text-gray-500">Note / Mese</Label>
                    <Input value={formData.periodo_riferimento} onChange={e => setFormData({...formData, periodo_riferimento: e.target.value})} placeholder="Es. Gennaio 2025" />
                 </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600">Registra e Notifica</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABELLA RIEPILOGATIVA */}
      <Card>
        <CardHeader><CardTitle>Storico Movimenti</CardTitle></CardHeader>
        <CardContent>
            <div className="space-y-4">
                {isLoading ? <p>Caricamento...</p> : payments?.map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">{getIcon(pay.tipo || '')}</div>
                            <div>
                                <p className="font-bold capitalize">{pay.tipo?.replace('_', ' ')}</p>
                                <p className="text-sm text-gray-500">
                                    {pay.bookings?.nome_ospite} • Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="font-bold text-lg">€{pay.importo}</p>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${pay.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {pay.stato?.replace('_', ' ')}
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => deleteExpense.mutate(pay.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {payments?.length === 0 && <div className="text-center text-gray-400 py-8">Nessuna spesa registrata.</div>}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}