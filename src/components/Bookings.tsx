import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch'; // Importante
import { Calendar as CalendarIcon, Plus, Copy, Eye, Check, X, FileText, User, Pencil, Trash2, AlertCircle, Wrench, CreditCard, MessageSquare, UserCog, ShieldCheck, Lock, Unlock } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import TicketManager from '@/components/TicketManager';

interface BookingsProps {
  initialBookingId?: string | null;
  onConsumeId?: () => void;
}

export default function Bookings({ initialBookingId, onConsumeId }: BookingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();
  
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [customerSheetOpen, setCustomerSheetOpen] = useState<any | null>(null);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [managingTicket, setManagingTicket] = useState<any>(null);

  const [formData, setFormData] = useState({
    property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
    data_inizio: undefined as Date | undefined, data_fine: undefined as Date | undefined, 
    tipo_affitto: 'breve'
  });

  // --- QUERY DATI ---
  const { data: bookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(nome)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const { data: activeDocs } = useQuery({
    queryKey: ['booking-docs', customerSheetOpen?.id],
    queryFn: async () => {
        if (!customerSheetOpen) return [];
        const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', customerSheetOpen.id).order('uploaded_at', { ascending: false });
        return data || [];
    },
    enabled: !!customerSheetOpen
  });

  const { data: activeTickets } = useQuery({
      queryKey: ['booking-tickets', customerSheetOpen?.id],
      queryFn: async () => {
          if (!customerSheetOpen) return [];
          const { data } = await supabase.from('tickets').select('*').eq('booking_id', customerSheetOpen.id).order('created_at', { ascending: false });
          return data || [];
      },
      enabled: !!customerSheetOpen
  });

  const { data: activePayments } = useQuery({
      queryKey: ['booking-payments', customerSheetOpen?.id],
      queryFn: async () => {
          if (!customerSheetOpen) return [];
          const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', customerSheetOpen.id).order('data_scadenza', { ascending: true });
          return data || [];
      },
      enabled: !!customerSheetOpen
  });

  React.useEffect(() => {
    if (initialBookingId && bookings && bookings.length > 0) {
      const targetBooking = bookings.find(b => b.id === initialBookingId);
      if (targetBooking) {
        setCustomerSheetOpen(targetBooking); 
        if (onConsumeId) onConsumeId();
      }
    }
  }, [initialBookingId, bookings, onConsumeId]);

  // --- MUTATIONS ---
  const createBooking = useMutation({
    mutationFn: async (newBooking: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bookings').insert({ ...newBooking, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setNewBookingOpen(false);
      toast({ title: 'Prenotazione creata' });
      setFormData({
        property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
        data_inizio: undefined, data_fine: undefined, tipo_affitto: 'breve'
      });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Prenotazione eliminata', variant: "destructive" });
    }
  });

  const updateBooking = useMutation({
    mutationFn: async (updatedData: any) => {
      const { error } = await supabase.from('bookings').update({
          data_inizio: format(updatedData.data_inizio, 'yyyy-MM-dd'),
          data_fine: format(updatedData.data_fine, 'yyyy-MM-dd'),
          email_ospite: updatedData.email_ospite,
          telefono_ospite: updatedData.telefono_ospite,
          tipo_affitto: updatedData.tipo_affitto
        }).eq('id', updatedData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditingBooking(null);
      toast({ title: 'Aggiornato' });
    }
  });

  // NUOVA MUTATION: SBLOCCO/BLOCCO CHECK-IN
  const toggleCheckinApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string, approved: boolean }) => {
        const { error } = await supabase.from('bookings').update({ documents_approved: approved }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        // Aggiorna anche lo stato locale per vedere subito il cambiamento nel dialog
        setCustomerSheetOpen((prev: any) => ({ ...prev, documents_approved: variables.approved }));
        toast({ 
            title: variables.approved ? "Accesso Sbloccato" : "Accesso Bloccato", 
            description: variables.approved ? "Il cliente può ora vedere i codici di accesso." : "Il cliente deve attendere la verifica."
        });
    },
    onError: (err: any) => toast({ title: "Errore aggiornamento", description: err.message, variant: "destructive" })
  });

  const reviewDoc = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('booking_documents').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-docs'] });
      toast({ title: "Stato Documento Aggiornato" });
    }
  });

  const copyLink = (booking: any) => {
    const baseUrl = window.location.origin;
    const path = booking.tipo_affitto === 'breve' ? '/guest/' : '/tenant/';
    const fullUrl = `${baseUrl}${path}${booking.id}`;
    navigator.clipboard.writeText(fullUrl);
    toast({ title: "Link Copiato!" });
  };

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  const getOccupiedDates = (propertyId: string, excludeBookingId?: string) => {
    if (!bookings || !propertyId) return [];
    return bookings
      .filter(b => b.property_id === propertyId && b.id !== excludeBookingId)
      .map(b => ({ from: new Date(b.data_inizio), to: new Date(b.data_fine) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Prenotazioni</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setNewBookingOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuova
        </Button>
      </div>

      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>Nuova Prenotazione</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <Label className="text-slate-700 font-bold mb-2 block">Tipo Contratto</Label>
                    <Select onValueChange={(v) => setFormData({...formData, tipo_affitto: v})} defaultValue="breve">
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="breve">🏖️ Affitto Breve (Turistico)</SelectItem>
                            <SelectItem value="lungo">🏠 Lungo Termine (Inquilino)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Immobile</Label>
                    <Select onValueChange={(v) => setFormData({...formData, property_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>{properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Ospite / Inquilino</Label>
                    <Input value={formData.nome_ospite} onChange={e => setFormData({...formData, nome_ospite: e.target.value})} placeholder="Nome Cognome" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Check-in / Inizio</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"}>{formData.data_inizio ? format(formData.data_inizio, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Calendar mode="single" selected={formData.data_inizio} onSelect={(d) => setFormData({...formData, data_inizio: d})} disabled={[...getOccupiedDates(formData.property_id), { before: new Date() }]} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-2">
                        <Label>Check-out / Fine</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"}>{formData.data_fine ? format(formData.data_fine, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Calendar mode="single" selected={formData.data_fine} onSelect={(d) => setFormData({...formData, data_fine: d})} disabled={[...getOccupiedDates(formData.property_id), { before: formData.data_inizio || new Date() }]} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <Button onClick={() => createBooking.mutate({...formData, data_inizio: format(formData.data_inizio!, 'yyyy-MM-dd'), data_fine: format(formData.data_fine!, 'yyyy-MM-dd')})} className="w-full bg-blue-600" disabled={!formData.property_id || !formData.data_inizio || !formData.data_fine}>Salva</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- SCHEDA CLIENTE COMPLETA --- */}
      <Dialog open={!!customerSheetOpen} onOpenChange={(open) => !open && setCustomerSheetOpen(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
            
            <div className="p-6 border-b bg-slate-50 flex justify-between items-start">
                <div className="flex gap-4 items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900">{customerSheetOpen?.nome_ospite}</DialogTitle>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{customerSheetOpen?.properties_real?.nome}</span> 
                            <span className="text-xs text-gray-400">|</span>
                            <span className="capitalize">{customerSheetOpen?.tipo_affitto} Termine</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(customerSheetOpen)} className="bg-white hover:bg-slate-50 text-blue-600 border-blue-200">
                        <Copy className="w-4 h-4 mr-2" /> Link Portale
                    </Button>
                    <Badge className={customerSheetOpen?.documents_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {customerSheetOpen?.documents_approved ? '✅ Accesso Sbloccato' : '🔒 Accesso Bloccato'}
                    </Badge>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs defaultValue="overview" className="flex-1 flex flex-col">
                    <div className="px-6 pt-4 border-b bg-white">
                        <TabsList className="grid w-full grid-cols-4 lg:w-[480px]">
                            <TabsTrigger value="overview">Panoramica</TabsTrigger>
                            <TabsTrigger value="docs">Documenti</TabsTrigger>
                            <TabsTrigger value="tickets">Ticket</TabsTrigger>
                            <TabsTrigger value="payments">Contabilità</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white/50">
                        
                        <TabsContent value="overview" className="mt-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-white border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Soggiorno</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-3 text-lg">
                                            <CalendarIcon className="w-5 h-5 text-blue-600"/>
                                            <span className="font-bold">{format(new Date(customerSheetOpen?.data_inizio || new Date()), 'dd MMM yyyy')}</span>
                                            <span className="text-gray-300">→</span>
                                            <span className="font-bold">{format(new Date(customerSheetOpen?.data_fine || new Date()), 'dd MMM yyyy')}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Contatti</CardTitle></CardHeader>
                                    <CardContent className="space-y-1">
                                        <p className="text-sm flex items-center gap-2"><span className="text-gray-400">✉️</span> {customerSheetOpen?.email_ospite || 'Nessuna email'}</p>
                                        <p className="text-sm flex items-center gap-2"><span className="text-gray-400">📞</span> {customerSheetOpen?.telefono_ospite || 'Nessun telefono'}</p>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {isBefore(new Date(customerSheetOpen?.data_fine), addDays(new Date(), 7)) && (
                                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex items-start gap-3 shadow-sm">
                                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-orange-800">In Scadenza</h4>
                                        <p className="text-sm text-orange-700">Il contratto scade tra meno di 7 giorni. Assicurati di aver programmato il check-out.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                                    <h3 className="text-2xl font-bold text-blue-700">{activeTickets?.filter(t => t.stato !== 'risolto').length || 0}</h3>
                                    <p className="text-xs text-blue-600 uppercase font-semibold">Ticket Aperti</p>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-center">
                                    <h3 className="text-2xl font-bold text-red-700">€{activePayments?.filter(p => p.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0) || 0}</h3>
                                    <p className="text-xs text-red-600 uppercase font-semibold">Da Saldare</p>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="docs" className="mt-0">
                            {/* --- NUOVA SEZIONE DI CONTROLLO ACCESSO --- */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className={`w-8 h-8 ${customerSheetOpen?.documents_approved ? 'text-green-600' : 'text-orange-500'}`} />
                                    <div>
                                        <h4 className="font-bold text-blue-900">Controllo Accessi</h4>
                                        <p className="text-sm text-blue-700">
                                            {customerSheetOpen?.documents_approved 
                                                ? "L'inquilino ha accesso completo al portale (chiavi e servizi)." 
                                                : "L'inquilino vede solo la schermata di verifica."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
                                    <Label className="cursor-pointer font-bold mr-2 text-slate-700">Accesso Sbloccato</Label>
                                    <Switch 
                                        checked={customerSheetOpen?.documents_approved || false}
                                        onCheckedChange={(val) => toggleCheckinApproval.mutate({ id: customerSheetOpen.id, approved: val })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                {activeDocs?.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-100 rounded text-slate-500"><FileText className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">{doc.filename}</p>
                                                <p className="text-xs text-gray-500">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => window.open(getDocUrl(doc.file_url), '_blank')}><Eye className="w-4 h-4 text-gray-500" /></Button>
                                            {doc.status === 'in_revisione' ? (
                                                <div className="flex gap-1">
                                                    <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'approvato' })} title="Approva"><Check className="w-4 h-4" /></Button>
                                                    <Button size="icon" className="h-7 w-7 bg-red-600 hover:bg-red-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'rifiutato' })} title="Rifiuta"><X className="w-4 h-4" /></Button>
                                                </div>
                                            ) : (
                                                <Badge variant={doc.status === 'approvato' ? 'default' : 'destructive'} className="capitalize">{doc.status}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activeDocs?.length === 0 && <div className="text-center text-gray-400 py-12 bg-slate-50 rounded-lg border border-dashed"><FileText className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nessun documento caricato dal cliente.</p></div>}
                            </div>
                        </TabsContent>

                        <TabsContent value="tickets" className="mt-0">
                            <div className="space-y-3">
                                {activeTickets?.map(ticket => (
                                    <div key={ticket.id} className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                                {ticket.priorita === 'alta' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                {ticket.titolo}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={ticket.stato === 'risolto' ? 'secondary' : 'destructive'} className="uppercase text-[10px] tracking-wider">{ticket.stato}</Badge>
                                                <Button size="sm" variant="ghost" className="h-6 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => setManagingTicket(ticket)}>
                                                    <UserCog className="w-3 h-3 mr-1" /> Gestisci
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-3 bg-slate-50 p-2 rounded border border-slate-100">"{ticket.descrizione}"</p>
                                        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                                            <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {format(new Date(ticket.created_at), 'dd MMM yyyy')}</span>
                                            {ticket.creato_da === 'ospite' && <span className="flex items-center gap-1 text-blue-500 font-medium"><MessageSquare className="w-3 h-3"/> Creato da Ospite</span>}
                                        </div>
                                    </div>
                                ))}
                                {activeTickets?.length === 0 && <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-lg border border-dashed"><Wrench className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nessuna segnalazione guasti.</p></div>}
                            </div>
                        </TabsContent>

                        <TabsContent value="payments" className="mt-0">
                            <div className="space-y-3">
                                {activePayments?.map(pay => (
                                    <div key={pay.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${pay.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 capitalize">{pay.tipo?.replace('_', ' ') || 'Rata'}</p>
                                                <p className="text-xs text-gray-500 font-medium">Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-slate-800">€ {pay.importo}</p>
                                            <Badge variant="outline" className={pay.stato === 'pagato' ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'}>{pay.stato.toUpperCase()}</Badge>
                                        </div>
                                    </div>
                                ))}
                                {activePayments?.length === 0 && <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-lg border border-dashed"><CreditCard className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nessun movimento contabile registrato.</p></div>}
                            </div>
                        </TabsContent>

                    </div>
                </Tabs>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCustomerSheetOpen(null)}>Chiudi Scheda</Button>
            </div>
        </DialogContent>
      </Dialog>

      {managingTicket && (
        <TicketManager 
            ticket={managingTicket} 
            isOpen={!!managingTicket} 
            onClose={() => setManagingTicket(null)}
            onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['booking-tickets'] });
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
            }}
            isReadOnly={managingTicket.stato === 'risolto'} 
        />
      )}

      {editingBooking && (
        <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Modifica Contatto</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="grid gap-2"><Label>Email</Label><Input value={editingBooking.email_ospite || ''} onChange={e => setEditingBooking({...editingBooking, email_ospite: e.target.value})} /></div>
                     <div className="grid gap-2"><Label>Telefono</Label><Input value={editingBooking.telefono_ospite || ''} onChange={e => setEditingBooking({...editingBooking, telefono_ospite: e.target.value})} /></div>
                     <Button onClick={() => updateBooking.mutate(editingBooking)} className="w-full">Salva Modifiche</Button>
                </div>
            </DialogContent>
        </Dialog>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings?.map((booking) => {
            const isShort = booking.tipo_affitto === 'breve';
            return (
            <Card key={booking.id} className={`border-l-4 shadow-sm group hover:shadow-md transition-all ${isShort ? 'border-l-orange-400' : 'border-l-purple-500'}`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold text-gray-800">{booking.nome_ospite}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1 font-medium">{booking.properties_real?.nome}</p>
                    </div>
                    <Badge variant="secondary" className={isShort ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}>{isShort ? 'Turista' : 'Inquilino'}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600 flex items-center gap-2 bg-gray-50 p-2 rounded">
                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                            {format(new Date(booking.data_inizio), 'dd MMM')} - {format(new Date(booking.data_fine), 'dd MMM yyyy')}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => copyLink(booking)} className="text-xs">
                                <Copy className="w-3 h-3 mr-2" /> Link
                            </Button>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs shadow-sm text-white" onClick={() => setCustomerSheetOpen(booking)}>
                                <User className="w-3 h-3 mr-2" /> Scheda Cliente
                            </Button>
                        </div>

                        <div className="flex justify-end gap-2 border-t pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-8 text-gray-400 hover:text-blue-600" onClick={() => setEditingBooking(booking)}><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 text-gray-400 hover:text-red-600" onClick={() => { if(confirm("Eliminare?")) deleteBooking.mutate(booking.id) }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            );
        })}
      </div>
    </div>
  );
}