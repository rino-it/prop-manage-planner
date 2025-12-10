import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Importante
import { Textarea } from '@/components/ui/textarea';
import { Home, Wifi, MapPin, FileText, Upload, Send, CheckCircle, XCircle, Clock, Key, Star, Ticket, CreditCard, UserCog, User, Phone, Mail, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from "jspdf";

export default function GuestPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);

  // STATI PER IL "GUEST GATE" (REGISTRAZIONE)
  const [isVerified, setIsVerified] = useState(false);
  const [guestData, setGuestData] = useState({ email: '', phone: '' });

  // 1. DATI PRENOTAZIONE
  const { data: booking, isLoading } = useQuery({
    queryKey: ['guest-booking', id],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(*)').eq('id', id).single();
      return data;
    },
    enabled: !!id
  });

  // EFFETTO: Controlla se i dati esistono già
  useEffect(() => {
    if (booking) {
      // Se ha già email E telefono, consideralo verificato (opzionale, rimuovi l'if se vuoi forzare sempre)
      if (booking.email_ospite && booking.telefono_ospite) {
         // setIsVerified(true); // Decommenta questa riga se vuoi saltare il login se i dati ci sono già
         setGuestData({ email: booking.email_ospite, phone: booking.telefono_ospite });
      }
    }
  }, [booking]);

  // MUTATION: AGGIORNA CONTATTI OSPITE
  const updateGuestContact = useMutation({
    mutationFn: async () => {
        if (!booking) return;
        const { error } = await supabase.from('bookings').update({
            email_ospite: guestData.email,
            telefono_ospite: guestData.phone
        }).eq('id', booking.id);
        
        if (error) throw error;
    },
    onSuccess: () => {
        setIsVerified(true);
        toast({ title: "Benvenuto!", description: "Accesso effettuato con successo." });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile salvare i dati.", variant: "destructive" })
  });


  // 2. EXTRA / PAGAMENTI
  const { data: payments } = useQuery({
    queryKey: ['guest-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 3. SERVIZI
  const { data: services } = useQuery({
    queryKey: ['guest-services', booking?.property_id],
    queryFn: async () => {
      if (!booking?.property_id) return [];
      const { data, error } = await supabase.from('services').select('*').eq('attivo', true);
      if (error) throw error;
      return data.filter(s => !s.property_ids || s.property_ids.length === 0 || s.property_ids.includes(booking.property_id));
    },
    enabled: !!booking?.property_id
  });

  // 4. DOCUMENTI
  const { data: documents } = useQuery({
    queryKey: ['guest-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 5. TICKET
  const { data: myTickets } = useQuery({
      queryKey: ['guest-tickets', id],
      queryFn: async () => {
          const { data } = await supabase.from('tickets').select('*').eq('booking_id', id).order('created_at', { ascending: false });
          return data || [];
      },
      enabled: !!id
  });

  // UPLOAD LOGIC
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `guest_${booking.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('booking_documents').insert({
        booking_id: booking.id, filename: file.name, file_url: fileName, status: 'in_revisione'
      });
      if (dbError) throw dbError;
      toast({ title: "Documento inviato", description: "Grazie! Lo verificheremo a breve." });
      queryClient.invalidateQueries({ queryKey: ['guest-docs'] });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const createTicket = useMutation({
      mutationFn: async () => {
        if (!booking) return;
        await supabase.from('tickets').insert({
          booking_id: booking.id, property_real_id: booking.property_id, titolo: ticketForm.titolo, descrizione: ticketForm.descrizione, stato: 'aperto', creato_da: 'ospite'
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['guest-tickets'] });
        toast({ title: "Richiesta inviata" });
        setTicketForm({ titolo: '', descrizione: '' });
      }
  });

  const handleVoucherDownload = (serviceTitle: string, serviceId: string) => {
    if (!booking?.data_fine) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [210, 100] });
    const primaryColor = "#16a34a"; 
    doc.setLineWidth(2); doc.setDrawColor(primaryColor); doc.rect(5, 5, 200, 90); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(primaryColor); doc.text("VOUCHER ESCLUSIVO", 105, 25, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor("#000000"); doc.text(serviceTitle.toUpperCase(), 105, 45, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor("#555555"); doc.text(`Riservato a: ${booking.nome_ospite}`, 15, 65); doc.text(`Struttura: ${booking.properties_real?.nome}`, 15, 72);
    const expiryDate = format(new Date(booking.data_fine), 'dd/MM/yyyy');
    const uniqueId = `${booking.id.slice(0,4).toUpperCase()}-${serviceId.slice(0,4).toUpperCase()}`;
    doc.setFont("helvetica", "bold"); doc.setTextColor("#dc2626"); doc.text(`VALIDO FINO AL: ${expiryDate}`, 195, 65, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setTextColor("#9ca3af"); doc.text(`ID UNIVOCO: ${uniqueId}`, 195, 72, { align: "right" });
    doc.setFontSize(8); doc.setTextColor("#9ca3af"); doc.text("Mostra questo voucher al partner per ottenere l'agevolazione. Non cedibile.", 105, 88, { align: "center" });
    doc.save(`Voucher_${serviceTitle.replace(/\s/g, '_')}.pdf`);
    toast({ title: "Voucher Scaricato" });
  };

  if (isLoading || !booking) return <div className="p-8 text-center">Caricamento portale ospite...</div>;

  // --- VISTA 1: GUEST GATE (REGISTRAZIONE) ---
  if (!isVerified) {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-600">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Home className="w-8 h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Benvenuto, {booking.nome_ospite?.split(' ')[0]}!</CardTitle>
                    <CardDescription>
                        Stai per accedere alla tua area riservata per <strong>{booking.properties_real?.nome}</strong>.
                        <br/>Per favore, conferma i tuoi contatti per proseguire.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Personale</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                id="email" 
                                placeholder="nome@esempio.com" 
                                className="pl-10" 
                                value={guestData.email} 
                                onChange={(e) => setGuestData({...guestData, email: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Numero di Telefono</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                id="phone" 
                                placeholder="+39 333 1234567" 
                                className="pl-10" 
                                value={guestData.phone}
                                onChange={(e) => setGuestData({...guestData, phone: e.target.value})}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg" 
                        onClick={() => updateGuestContact.mutate()}
                        disabled={!guestData.email || !guestData.phone}
                    >
                        <LogIn className="w-5 h-5 mr-2" /> Accedi al Portale
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  // --- VISTA 2: PORTALE OSPITE (ACCESSO EFFETTUATO) ---
  const getStatusBadge = (status: string) => {
      if (status === 'approvato') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1"/> OK</Badge>;
      if (status === 'rifiutato') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1"/> No</Badge>;
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1"/> In Verifica</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* HEADER BENVENUTO */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
        <div className="bg-blue-600 h-24 relative">
            <div className="absolute -bottom-10 left-6 p-4 bg-white rounded-xl shadow border">
                <Home className="w-8 h-8 text-blue-600" />
            </div>
        </div>
        <div className="pt-12 px-6 pb-6">
            <h1 className="text-2xl font-bold text-gray-900">Area Ospite: {booking.nome_ospite}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {booking.properties_real?.nome}</span>
                <span className="flex items-center"><Wifi className="w-4 h-4 mr-1" /> WiFi: {booking.properties_real?.wifi_ssid || 'Chiedi'}</span>
                <span className="flex items-center"><Key className="w-4 h-4 mr-1" /> Check-in: {format(new Date(booking.data_inizio), 'dd MMM')}</span>
            </div>
        </div>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="services">Esperienze</TabsTrigger>
          <TabsTrigger value="info">Costi Extra</TabsTrigger>
          <TabsTrigger value="support">Assistenza</TabsTrigger>
          <TabsTrigger value="docs">Documenti</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                {services?.map(service => {
                    const isPremium = !!service.payment_link;
                    return (
                        <Card key={service.id} className={`overflow-hidden border-l-4 transition-shadow hover:shadow-md flex flex-col ${isPremium ? 'border-l-yellow-400' : 'border-l-green-500'}`}>
                            <div className="h-32 bg-gray-100 relative">
                                {service.immagine_url ? (
                                    <img src={service.immagine_url} alt={service.titolo} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Star className="w-10 h-10" /></div>
                                )}
                                <div className="absolute top-2 right-2">
                                    {isPremium ? 
                                        <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-sm">Premium</Badge> : 
                                        <Badge className="bg-green-500 hover:bg-green-600 text-white shadow-sm">Sconto Partner</Badge>
                                    }
                                </div>
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex justify-between items-start">
                                    <span className="truncate pr-2">{service.titolo}</span>
                                    <span className="text-base font-bold text-gray-700 whitespace-nowrap">€ {service.prezzo}</span>
                                </CardTitle>
                                <CardDescription className="line-clamp-2">{service.descrizione}</CardDescription>
                            </CardHeader>
                            <CardFooter className="mt-auto pt-0">
                                {isPremium ? (
                                    <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold" onClick={() => window.open(service.payment_link, '_blank')}>
                                        <CreditCard className="w-4 h-4 mr-2" /> Prenota & Paga
                                    </Button>
                                ) : (
                                    <Button variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleVoucherDownload(service.titolo, service.id)}>
                                        <Ticket className="w-4 h-4 mr-2" /> Scarica Voucher
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Riepilogo Costi</CardTitle><CardDescription>Eventuali extra o tassa di soggiorno.</CardDescription></CardHeader>
            <CardContent>
                {payments?.map((pay) => (
                    <div key={pay.id} className="flex justify-between items-center p-3 border-b last:border-0">
                        <div><p className="font-medium capitalize">{pay.tipo?.replace('_', ' ')}</p><p className="text-xs text-gray-500">{format(new Date(pay.data_scadenza), 'dd MMM')}</p></div>
                        <div className="text-right"><p className="font-bold">€{pay.importo}</p><Badge variant="outline">{pay.stato}</Badge></div>
                    </div>
                ))}
                {payments?.length === 0 && <p className="text-center text-gray-400 py-4">Nessun costo extra da saldare.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
           <Card>
                <CardHeader><CardTitle>Hai bisogno di aiuto?</CardTitle><CardDescription>Segnala un guasto o fai una richiesta.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Oggetto (es. Info parcheggio)" value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                    <Textarea placeholder="Scrivi qui..." value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} />
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}><Send className="w-4 h-4 mr-2" /> Invia Richiesta</Button>
                </CardContent>
            </Card>
            <div className="space-y-3">
                {myTickets?.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <div><p className="font-medium text-gray-900">{t.titolo}</p><p className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd MMM')}</p></div>
                            <Badge variant={t.stato === 'risolto' ? 'default' : 'secondary'}>{t.stato}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2">"{t.descrizione}"</p>
                        {t.share_notes && t.admin_notes && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md">
                                <p className="text-xs font-bold text-blue-700 mb-1 flex items-center"><UserCog className="w-3 h-3 mr-1" /> Aggiornamento Staff:</p>
                                <p className="text-sm text-blue-900">{t.admin_notes}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </TabsContent>

        <TabsContent value="docs">
           <Card className="border-dashed border-2 mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="py-8 flex flex-col items-center text-center">
                <div className="p-3 bg-white rounded-full mb-3"><Upload className="w-6 h-6 text-blue-600" /></div>
                <h3 className="font-bold text-gray-900">Check-in Online</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-xs">Carica qui la foto dei documenti.</p>
                <label className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium bg-white hover:bg-gray-100 text-blue-700 h-10 px-6 py-2 shadow-sm border ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? "Caricamento..." : "Seleziona Foto/PDF"}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
            </CardContent>
           </Card>
           <div className="space-y-3">
                {documents?.map(doc => (
                    <div key={doc.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-gray-400" /><div className="overflow-hidden"><p className="font-medium text-sm truncate w-40">{doc.filename}</p><p className="text-xs text-gray-400">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p></div></div>
                        {getStatusBadge(doc.status)}
                    </div>
                ))}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}