import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, isWithinInterval } from 'date-fns';
import { TrendingDown, Users, Building2, Calendar, Share2, CheckCircle, Clock, Search, MessageCircle, Phone } from 'lucide-react';
import { usePropertiesReal } from '@/hooks/useProperties';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function Expenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // STATI FORM
  const [activeTab, setActiveTab] = useState('owner');
  const [formData, setFormData] = useState({
    property_id: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'manutenzione',
    description: '',
    supplier: '', 
    supplier_contact: '', // <--- NUOVO CAMPO TELEFONO
    assigned_to: '',
    booking_id: ''
  });

  // 1. CARICA SPESE PROPRIETARIO
  const { data: ownerExpenses } = useQuery({
    queryKey: ['owner-expenses'],
    queryFn: async () => {
      const { data } = await supabase.from('property_expenses').select('*, properties_real(nome)').order('date', { ascending: false });
      return data || [];
    }
  });

  // 2. CARICA ADDEBITI INQUILINI
  const { data: tenantCharges } = useQuery({
    queryKey: ['tenant-charges'],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments')
        .select('*, bookings(nome_ospite, properties_real(nome))')
        .neq('category', 'canone_locazione')
        .order('data_scadenza', { ascending: false });
      return data || [];
    }
  });

  // 3. CARICA BOOKING
  const { data: bookings } = useQuery({
    queryKey: ['all-bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('id, nome_ospite, property_id, data_inizio, data_fine');
      return data || [];
    }
  });

  // AUTO-SUGGEST
  useEffect(() => {
    if (activeTab === 'tenant' && formData.property_id && formData.date && bookings) {
      const targetDate = new Date(formData.date);
      const found = bookings.find(b => 
        b.property_id === formData.property_id &&
        isWithinInterval(targetDate, { start: new Date(b.data_inizio), end: new Date(b.data_fine) })
      );
      if (found) {
        setFormData(prev => ({ ...prev, booking_id: found.id }));
        toast({ title: "Inquilino Trovato!", description: `Assegnato a ${found.nome_ospite}` });
      } else {
        setFormData(prev => ({ ...prev, booking_id: '' }));
      }
    }
  }, [formData.property_id, formData.date, activeTab]);

  // MUTATION: SPESA PROPRIETARIO
  const createOwnerExpense = useMutation({
    mutationFn: async () => {
      await supabase.from('property_expenses').insert({
        property_id: formData.property_id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        description: formData.description,
        supplier: formData.supplier,
        supplier_contact: formData.supplier_contact, // <--- SALVIAMO IL NUMERO
        assigned_to: formData.assigned_to
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-expenses'] });
      setIsDialogOpen(false);
      toast({ title: "Spesa Registrata" });
      setFormData({ ...formData, amount: '', description: '', supplier: '', supplier_contact: '' });
    }
  });

  // MUTATION: ADDEBITO INQUILINO
  const createTenantCharge = useMutation({
    mutationFn: async () => {
      if (!formData.booking_id) throw new Error("Seleziona un inquilino!");
      await supabase.from('tenant_payments').insert({
        booking_id: formData.booking_id,
        importo: parseFloat(formData.amount),
        data_scadenza: formData.date,
        category: 'rimborso_utenze',
        description: formData.description,
        stato: 'da_pagare'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-charges'] });
      setIsDialogOpen(false);
      toast({ title: "Addebito Inviato" });
    },
    onError: () => toast({ title: "Errore", description: "Manca l'inquilino", variant: "destructive" })
  });

  const confirmPayment = useMutation({
    mutationFn: async (id: string) => {
        await supabase.from('tenant_payments').update({ stato: 'pagato' }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-charges'] })
  });

  const sendDelegation = (expense: any) => {
    if (!expense.assigned_to) return alert("Inserisci il nome del socio");
    const text = `Ciao ${expense.assigned_to}, per favore paga questa spesa:\n\n🏠 ${expense.properties_real?.nome}\n💰 €${expense.amount} (${expense.category})\n📅 Scadenza: ${expense.date}\n📝 Note: ${expense.description}\n🛒 Fornitore: ${expense.supplier || 'N/A'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const contactSupplier = (phone: string) => {
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const handleSubmit = () => {
    if (activeTab === 'owner') createOwnerExpense.mutate();
    else createTenantCharge.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Centro Spese</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700 shadow-sm">
              <TrendingDown className="w-4 h-4 mr-2" /> Registra Uscita
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Nuova Uscita</DialogTitle></DialogHeader>
            
            <Tabs defaultValue="owner" className="w-full mt-2" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="owner">🏢 Spesa Proprietario</TabsTrigger>
                    <TabsTrigger value="tenant">👤 Addebito Inquilino</TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Proprietà</Label>
                            <Select onValueChange={(v) => setFormData({...formData, property_id: v})}>
                                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                <SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>{activeTab === 'owner' ? 'Data Pagamento' : 'Data Spesa'}</Label>
                            <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Importo (€)</Label>
                        <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Descrizione</Label>
                        <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es. Bolletta Enel Maggio" />
                    </div>

                    {activeTab === 'owner' ? (
                        <>
                            <div className="grid gap-2">
                                <Label>Categoria</Label>
                                <Select onValueChange={(v) => setFormData({...formData, category: v})} defaultValue="manutenzione">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manutenzione">Manutenzione</SelectItem>
                                        <SelectItem value="imu">IMU / Tasse</SelectItem>
                                        <SelectItem value="condominio_prop">Condominio (Proprietà)</SelectItem>
                                        <SelectItem value="assicurazione">Assicurazione</SelectItem>
                                        <SelectItem value="mutuo">Mutuo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* SEZIONE FORNITORE AGGIORNATA */}
                            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                                <Label className="text-slate-700 font-semibold">Fornitore / Addetto</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input 
                                        placeholder="Nome (es. Idraulico)" 
                                        value={formData.supplier} 
                                        onChange={e => setFormData({...formData, supplier: e.target.value})} 
                                    />
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Tel (39...)" 
                                            value={formData.supplier_contact} 
                                            onChange={e => setFormData({...formData, supplier_contact: e.target.value})} 
                                        />
                                        {formData.supplier_contact && (
                                            <Button size="icon" variant="outline" className="text-green-600 border-green-200 bg-green-50" onClick={() => contactSupplier(formData.supplier_contact)}>
                                                <MessageCircle className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Delega Pagamento a (Socio)</Label>
                                <Input placeholder="Es. Marco" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} />
                            </div>
                        </>
                    ) : (
                        <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <Label className="text-blue-800 flex items-center gap-2 mb-2"><Search className="w-4 h-4"/> Assegnazione Automatica</Label>
                            {formData.booking_id ? (
                                <div className="flex items-center gap-2 text-green-700 font-bold"><CheckCircle className="w-4 h-4"/> Assegnato a: {bookings?.find(b => b.id === formData.booking_id)?.nome_ospite}</div>
                            ) : (
                                <div className="text-sm text-gray-500">Seleziona casa e data per trovare l'inquilino.</div>
                            )}
                        </div>
                    )}

                    <Button onClick={handleSubmit} className="w-full mt-4 bg-red-600 hover:bg-red-700">
                        {activeTab === 'owner' ? 'Registra Costo' : 'Invia Addebito'}
                    </Button>
                </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="owner_view" className="w-full">
        <TabsList>
            <TabsTrigger value="owner_view">Spese Gestione</TabsTrigger>
            <TabsTrigger value="tenant_view">Addebiti & Rimborsi</TabsTrigger>
        </TabsList>

        <TabsContent value="owner_view">
            <Card>
                <CardHeader><CardTitle>Costi di Gestione (ROI)</CardTitle></CardHeader>
                <CardContent>
                    {ownerExpenses?.map(exp => (
                        <div key={exp.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-red-100 text-red-700 rounded-full"><Building2 className="w-5 h-5"/></div>
                                <div>
                                    <p className="font-bold">{exp.description}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span>{exp.properties_real?.nome} • {exp.category}</span>
                                        {exp.supplier && (
                                            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700">
                                                🛒 {exp.supplier}
                                                {exp.supplier_contact && (
                                                    <MessageCircle 
                                                        className="w-3 h-3 text-green-600 cursor-pointer hover:scale-110 transition-transform" 
                                                        onClick={(e) => { e.stopPropagation(); contactSupplier(exp.supplier_contact); }}
                                                    />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-bold text-red-600">- €{exp.amount}</p>
                                    <p className="text-xs text-gray-400">{format(new Date(exp.date), 'dd MMM yyyy')}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => sendDelegation(exp)}>
                                    <Share2 className="w-4 h-4 mr-2" /> Delega
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="tenant_view">
            <Card>
                <CardHeader><CardTitle>Monitoraggio Rimborsi</CardTitle></CardHeader>
                <CardContent>
                    {tenantCharges?.map(charge => (
                        <div key={charge.id} className={`flex justify-between items-center p-4 border-b last:border-0 ${charge.stato === 'in_verifica' ? 'bg-yellow-50' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full ${charge.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    <Users className="w-5 h-5"/>
                                </div>
                                <div>
                                    <p className="font-bold">{charge.bookings?.nome_ospite}</p>
                                    <p className="text-sm text-gray-500">{charge.description}</p>
                                    {charge.stato === 'in_verifica' && (
                                        <Badge className="bg-yellow-200 text-yellow-800 mt-1 hover:bg-yellow-200">
                                            <Clock className="w-3 h-3 mr-1" /> Pagamento Segnalato
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-bold">€{charge.importo}</p>
                                </div>
                                {charge.stato !== 'pagato' ? (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => confirmPayment.mutate(charge.id)}>
                                        <CheckCircle className="w-4 h-4 mr-2" /> Conferma
                                    </Button>
                                ) : (
                                    <Badge variant="outline" className="text-green-600 border-green-200">Pagato</Badge>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}