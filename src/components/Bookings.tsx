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
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarIcon, Plus, Copy, Eye, Check, X, FileText, User, Pencil, Trash2, AlertCircle, Wrench, CreditCard, MessageSquare, UserCog, ShieldCheck, Upload, Loader2 } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import TicketManager from '@/components/TicketManager';
import { useGeneratePaymentSchedule, useBookingPayments, useEmailLog, useDeleteTenantPayment } from '@/hooks/useStripePayments';
import AddPaymentDialog from '@/components/AddPaymentDialog';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import PaymentCard from '@/components/PaymentCard';
import CauzioneManager from '@/components/CauzioneManager';
import { Mail, Calendar as CalIcon } from 'lucide-react';

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

  // FIX: Stato per upload documento host
  const [hostDocFile, setHostDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const [formData, setFormData] = useState({
    property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
    data_inizio: undefined as Date | undefined, data_fine: undefined as Date | undefined,
    tipo_affitto: 'breve'
  });

  const generateSchedule = useGeneratePaymentSchedule();
  const deletePayment = useDeleteTenantPayment();
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addPaymentBookingId, setAddPaymentBookingId] = useState<string | null>(null);
  const [addPaymentBookingName, setAddPaymentBookingName] = useState<string | undefined>(undefined);
  const [formNumeroOspiti, setFormNumeroOspiti] = useState(1);
  const [formTotalAmount, setFormTotalAmount] = useState('');

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
      const { error, data: createdBooking } = await supabase.from('bookings').insert({ ...newBooking, user_id: user?.id }).select().single();
      if (error) throw error;

      if (createdBooking && newBooking.tipo_affitto === 'breve' && newBooking.total_amount > 0) {
        try {
          await supabase.functions.invoke('generate-payment-schedule', { body: { booking_id: createdBooking.id } });
        } catch (e) {
          console.error('Piano pagamenti non generato:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setNewBookingOpen(false);
      toast({ title: 'Prenotazione creata' });
      setFormData({
        property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
        data_inizio: undefined, data_fine: undefined, tipo_affitto: 'breve'
      });
      setFormNumeroOspiti(1);
      setFormTotalAmount('');
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

  const toggleCheckinApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string, approved: boolean }) => {
        const { error } = await supabase.from('bookings').update({ documents_approved: approved }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
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

  // FIX: Funzione per caricare documenti come Host
  const handleHostUpload = async () => {
    if (!hostDocFile || !customerSheetOpen) return;
    setIsUploadingDoc(true);
    try {
        const fileExt = hostDocFile.name.split('.').pop();
        const fileName = `booking_${customerSheetOpen.id}_${Date.now()}.${fileExt}`;
        
        // 1. Upload Storage
        const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, hostDocFile);
        if (uploadError) throw uploadError;

        // 2. Insert DB
        const { error: dbError } = await supabase.from('booking_documents').insert({
            booking_id: customerSheetOpen.id,
            filename: hostDocFile.name,
            file_url: fileName,
            status: 'approvato', // Approvato di default perché caricato dall'host
            uploaded_at: new Date().toISOString()
        });
        if (dbError) throw dbError;

        toast({ title: "Documento Caricato", description: "L'inquilino potrà vederlo nel suo portale." });
        setHostDocFile(null);
        queryClient.invalidateQueries({ queryKey: ['booking-docs'] });

    } catch (e: any) {
        toast({ title: "Errore Upload", description: e.message, variant: "destructive" });
    } finally {
        setIsUploadingDoc(false);
    }
  };

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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Prenotazioni</h1>
        <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto" onClick={() => setNewBookingOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuova
        </Button>
      </div>

      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Check-in / Inizio</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{formData.data_inizio ? format(formData.data_inizio, "dd/MM/yyyy") : "Seleziona data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                                <Calendar mode="single" selected={formData.data_inizio} onSelect={(d) => setFormData({...formData, data_inizio: d})} disabled={[...getOccupiedDates(formData.property_id), { before: new Date() }]} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-2">
                        <Label>Check-out / Fine</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{formData.data_fine ? format(formData.data_fine, "dd/MM/yyyy") : "Seleziona data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                                <Calendar mode="single" selected={formData.data_fine} onSelect={(d) => setFormData({...formData, data_fine: d})} disabled={[...getOccupiedDates(formData.property_id), { before: formData.data_inizio ? addDays(formData.data_inizio, 1) : new Date() }]} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                {formData.tipo_affitto === 'breve' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Ospiti</Label>
                            <Input type="number" min={1} value={formNumeroOspiti} onChange={e => setFormNumeroOspiti(Number(e.target.value))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Totale Soggiorno (EUR)</Label>
                            <Input type="number" min={0} step="0.01" placeholder="0.00" value={formTotalAmount} onChange={e => setFormTotalAmount(e.target.value)} />
                        </div>
                    </div>
                )}
                <Button onClick={() => createBooking.mutate({...formData, data_inizio: format(formData.data_inizio!, 'yyyy-MM-dd'), data_fine: format(formData.data_fine!, 'yyyy-MM-dd'), numero_ospiti: formNumeroOspiti, total_amount: formTotalAmount ? parseFloat(formTotalAmount) : null})} className="w-full bg-blue-600" disabled={!formData.property_id || !formData.data_inizio || !formData.data_fine}>Salva</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- SCHEDA CLIENTE COMPLETA --- */}
      <Dialog open={!!customerSheetOpen} onOpenChange={(open) => !open && setCustomerSheetOpen(null)}>
        <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] p-0 !overflow-hidden">
          <div className="flex flex-col h-full min-h-0">
            <div className="p-3 md:p-6 border-b bg-slate-50 shrink-0">
                <div className="flex gap-3 items-center">
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 shrink-0">
                        <User className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base md:text-xl font-bold text-gray-900 truncate">{customerSheetOpen?.nome_ospite}</DialogTitle>
                        <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[120px] sm:max-w-[200px]">{customerSheetOpen?.properties_real?.nome}</span>
                            <span className="text-gray-400">|</span>
                            <span className="capitalize">{customerSheetOpen?.tipo_affitto} Termine</span>
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => copyLink(customerSheetOpen)} className="bg-white hover:bg-slate-50 text-blue-600 border-blue-200 h-7 text-[10px] px-2">
                            <Copy className="w-3 h-3 mr-1" /> Link
                        </Button>
                        <Badge className={`text-[9px] ${customerSheetOpen?.documents_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {customerSheetOpen?.documents_approved ? 'Sbloccato' : 'Bloccato'}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
                    <div className="px-4 md:px-6 pt-4 border-b bg-white shrink-0">
                        <TabsList className="w-full grid grid-cols-4">
                            <TabsTrigger value="overview" className="text-xs sm:text-sm px-1">Panoramica</TabsTrigger>
                            <TabsTrigger value="docs" className="text-xs sm:text-sm px-1">Documenti</TabsTrigger>
                            <TabsTrigger value="tickets" className="text-xs sm:text-sm px-1">Ticket</TabsTrigger>
                            <TabsTrigger value="payments" className="text-xs sm:text-sm px-1">Contabilita</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white/50">
                        
                        <TabsContent value="overview" className="mt-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-white border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Soggiorno</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-base md:text-lg">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="w-5 h-5 text-blue-600"/>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="font-bold hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                                                            {format(new Date(customerSheetOpen?.data_inizio || new Date()), 'dd MMM yyyy')}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-auto" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={new Date(customerSheetOpen?.data_inizio)}
                                                            onSelect={(d) => {
                                                                if (!d) return;
                                                                updateBooking.mutate({
                                                                    ...customerSheetOpen,
                                                                    data_inizio: d,
                                                                    data_fine: new Date(customerSheetOpen.data_fine),
                                                                });
                                                                setCustomerSheetOpen({ ...customerSheetOpen, data_inizio: format(d, 'yyyy-MM-dd') });
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <span className="text-gray-300 hidden sm:inline">→</span>
                                            <span className="text-gray-300 sm:hidden">fino al</span>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="font-bold hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                                                        {format(new Date(customerSheetOpen?.data_fine || new Date()), 'dd MMM yyyy')}
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 w-auto" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={new Date(customerSheetOpen?.data_fine)}
                                                        onSelect={(d) => {
                                                            if (!d) return;
                                                            updateBooking.mutate({
                                                                ...customerSheetOpen,
                                                                data_inizio: new Date(customerSheetOpen.data_inizio),
                                                                data_fine: d,
                                                            });
                                                            setCustomerSheetOpen({ ...customerSheetOpen, data_fine: format(d, 'yyyy-MM-dd') });
                                                        }}
                                                        disabled={{ before: addDays(new Date(customerSheetOpen?.data_inizio || new Date()), 1) }}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 font-medium uppercase tracking-wider">Contatti</CardTitle></CardHeader>
                                    <CardContent className="space-y-1">
                                        <p className="text-sm flex items-center gap-2 truncate"><span className="text-gray-400">✉️</span> {customerSheetOpen?.email_ospite || 'Nessuna email'}</p>
                                        <p className="text-sm flex items-center gap-2"><span className="text-gray-400">📞</span> {customerSheetOpen?.telefono_ospite || 'Nessun telefono'}</p>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {isBefore(new Date(customerSheetOpen?.data_fine), addDays(new Date(), 7)) && (
                                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex items-start gap-3 shadow-sm">
                                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-orange-800 text-sm">In Scadenza</h4>
                                        <p className="text-xs md:text-sm text-orange-700">Il contratto scade tra meno di 7 giorni. Assicurati di aver programmato il check-out.</p>
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
                            {/* --- CONTROLLO ACCESSO --- */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className={`w-8 h-8 ${customerSheetOpen?.documents_approved ? 'text-green-600' : 'text-orange-500'} shrink-0`} />
                                    <div>
                                        <h4 className="font-bold text-blue-900 text-sm">Controllo Accessi</h4>
                                        <p className="text-xs text-blue-700">
                                            {customerSheetOpen?.documents_approved 
                                                ? "L'inquilino ha accesso completo." 
                                                : "L'inquilino vede solo la verifica."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border w-full sm:w-auto justify-between sm:justify-start">
                                    <Label className="cursor-pointer font-bold mr-2 text-slate-700 text-sm">Accesso Sbloccato</Label>
                                    <Switch 
                                        checked={customerSheetOpen?.documents_approved || false}
                                        onCheckedChange={(val) => toggleCheckinApproval.mutate({ id: customerSheetOpen.id, approved: val })}
                                    />
                                </div>
                            </div>

                            {/* FIX: SEZIONE UPLOAD HOST */}
                            <div className="bg-slate-50 p-4 border border-dashed border-slate-300 rounded-lg mb-4">
                                <Label className="text-sm font-bold text-slate-700 mb-2 block">Carica Documento per Inquilino</Label>
                                <div className="flex gap-2 items-center">
                                    <Input type="file" className="bg-white" onChange={(e) => setHostDocFile(e.target.files?.[0] || null)} />
                                    <Button onClick={handleHostUpload} disabled={!hostDocFile || isUploadingDoc} className="bg-blue-600 hover:bg-blue-700">
                                        {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4 mr-2"/>}
                                        Carica
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {activeDocs?.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                                        <div className="p-2 bg-slate-100 rounded text-slate-500 shrink-0"><FileText className="w-4 h-4" /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm text-gray-900 break-all line-clamp-2">{doc.filename}</p>
                                            <p className="text-xs text-gray-500">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(getDocUrl(doc.file_url), '_blank')}><Eye className="w-4 h-4 text-gray-500" /></Button>
                                            {doc.status === 'in_revisione' ? (
                                                <div className="flex gap-1">
                                                    <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'approvato' })} title="Approva"><Check className="w-4 h-4" /></Button>
                                                    <Button size="icon" className="h-7 w-7 bg-red-600 hover:bg-red-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'rifiutato' })} title="Rifiuta"><X className="w-4 h-4" /></Button>
                                                </div>
                                            ) : (
                                                <Badge variant={doc.status === 'approvato' ? 'default' : 'destructive'} className="capitalize text-[10px]">{doc.status}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activeDocs?.length === 0 && <div className="text-center text-gray-400 py-12 bg-slate-50 rounded-lg border border-dashed"><FileText className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nessun documento.</p></div>}
                            </div>
                        </TabsContent>

                        <TabsContent value="tickets" className="mt-0">
                            <div className="space-y-3">
                                {activeTickets?.map(ticket => (
                                    <div key={ticket.id} className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                                                {ticket.priorita === 'alta' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                                                {ticket.titolo}
                                            </h4>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Badge variant={ticket.stato === 'risolto' ? 'secondary' : 'destructive'} className="uppercase text-[10px] tracking-wider">{ticket.stato}</Badge>
                                                <Button size="sm" variant="ghost" className="h-6 text-blue-600 hover:bg-blue-50 hover:text-blue-700 px-2" onClick={() => setManagingTicket(ticket)}>
                                                    <UserCog className="w-3 h-3 sm:mr-1" /> <span className="hidden sm:inline">Gestisci</span>
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs md:text-sm text-gray-600 mb-3 bg-slate-50 p-2 rounded border border-slate-100">"{ticket.descrizione}"</p>
                                        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                                            <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {format(new Date(ticket.created_at), 'dd MMM yyyy')}</span>
                                            {ticket.creato_da === 'ospite' && <span className="flex items-center gap-1 text-blue-500 font-medium"><MessageSquare className="w-3 h-3"/> Ospite</span>}
                                        </div>
                                    </div>
                                ))}
                                {activeTickets?.length === 0 && <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-lg border border-dashed"><Wrench className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nessuna segnalazione.</p></div>}
                            </div>
                        </TabsContent>

                        <TabsContent value="payments" className="mt-0 space-y-4">
                            {/* Header con bottone aggiungi */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500 font-medium">Pagamenti prenotazione</p>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                                    onClick={() => { setAddPaymentBookingId(customerSheetOpen?.id ?? null); setAddPaymentBookingName(customerSheetOpen?.nome_ospite); setAddPaymentOpen(true); }}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi
                                </Button>
                            </div>

                            {/* Riepilogo */}
                            {activePayments && activePayments.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border p-3 md:p-4">
                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                                        <span className="text-gray-500">Totale: <strong className="text-gray-900">EUR {activePayments.reduce((acc, p) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                                        <span className="text-green-600">Pagato: <strong>EUR {activePayments.filter(p => p.stato === 'pagato').reduce((acc, p) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                                    </div>
                                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.round(activePayments.filter(p => p.stato === 'pagato').reduce((acc, p) => acc + Number(p.importo), 0) / activePayments.reduce((acc, p) => acc + Number(p.importo), 0) * 100)}%` }} />
                                    </div>
                                </div>
                            )}

                            {/* Pagamenti */}
                            <div className="space-y-3">
                                {activePayments?.map(pay => (
                                    <div key={pay.id}>
                                        <div className="p-3 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                                            <div className="flex items-center gap-2 md:gap-4">
                                                <div className={`p-2 rounded-full shrink-0 ${pay.stato === 'pagato' ? 'bg-green-100 text-green-700' : pay.stato === 'pre_autorizzato' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                    <CreditCard className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-gray-900 capitalize text-sm truncate">{(pay.payment_type || pay.tipo || 'Rata').replace('_', ' ')}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p>
                                                    {pay.description && <p className="text-xs text-gray-400 truncate mt-0.5">{pay.description}</p>}
                                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                        {pay.is_preauth && <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-200">Pre-auth</Badge>}
                                                        {pay.stripe_checkout_url && pay.stato === 'da_pagare' && <Badge variant="outline" className="text-[9px] text-green-600 border-green-200">⚡ Link Stripe</Badge>}
                                                        {!pay.stripe_checkout_url && pay.stato === 'da_pagare' && <Badge variant="outline" className="text-[9px] text-orange-500 border-orange-200">No link</Badge>}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                    <p className="font-bold text-sm md:text-lg text-slate-800">EUR {pay.importo}</p>
                                                    <Badge variant="outline" className={`text-[9px] ${pay.stato === 'pagato' ? 'text-green-600 border-green-200 bg-green-50' : pay.stato === 'pre_autorizzato' ? 'text-blue-600 border-blue-200 bg-blue-50' : pay.stato === 'rilasciato' ? 'text-gray-600 border-gray-200 bg-gray-50' : 'text-red-600 border-red-200 bg-red-50'}`}>{pay.stato?.toUpperCase()}</Badge>
                                                    {pay.receipt_url && <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600 px-1" onClick={() => window.open(pay.receipt_url, '_blank')}>Ricevuta</Button>}
                                                    {pay.stato === 'da_pagare' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-[10px] text-red-400 hover:text-red-600 px-1"
                                                            onClick={() => { if (confirm('Eliminare questo pagamento?')) deletePayment.mutate({ payment_id: pay.id, booking_id: customerSheetOpen?.id }) }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {pay.is_preauth && ['pre_autorizzato', 'pagato', 'rilasciato'].includes(pay.stato) && (
                                            <CauzioneManager payment={pay} bookingId={customerSheetOpen?.id} />
                                        )}
                                    </div>
                                ))}
                                {activePayments?.length === 0 && (
                                    <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-lg border border-dashed">
                                        <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-20"/>
                                        <p className="mb-3">Nessun pagamento.</p>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => { setAddPaymentBookingId(customerSheetOpen?.id ?? null); setAddPaymentBookingName(customerSheetOpen?.nome_ospite); setAddPaymentOpen(true); }}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi il primo
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                    </div>
                </Tabs>
            </div>
            
            <div className="p-3 md:p-4 border-t bg-slate-50 flex justify-end shrink-0">
                <Button variant="outline" size="sm" onClick={() => setCustomerSheetOpen(null)}>Chiudi Scheda</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD PAYMENT DIALOG */}
      <AddPaymentDialog
        open={addPaymentOpen}
        onOpenChange={setAddPaymentOpen}
        bookingId={addPaymentBookingId}
        bookingName={addPaymentBookingName}
      />

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
            <DialogContent className="sm:max-w-[400px] w-[95vw]">
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
                        {booking.source === 'ical_import' && (
                            <Badge variant="outline" className="text-[10px] text-cyan-600 border-cyan-200 bg-cyan-50 w-fit">iCal Import</Badge>
                        )}
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

                        <div className="flex justify-end gap-2 border-t pt-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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