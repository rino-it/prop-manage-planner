import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, MapPin, Lock, Unlock, Youtube, Copy, Loader2, 
  CheckCircle, FileText, Calendar, Clock, ShieldCheck, UploadCloud, Send, UserCog, AlertTriangle, Download, Utensils
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

export default function GuestPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  
  // Stato per Ticket Pagamento
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });

  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // --- QUERIES ---
  const { data: booking, isLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(*)').eq('id', id).single();
      return data;
    },
    enabled: !!id
  });

  const { data: documents } = useQuery({
    queryKey: ['tenant-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // Query per Esperienze (REINSERITA)
  const { data: services } = useQuery({
    queryKey: ['guest-services'],
    queryFn: async () => {
        const { data } = await supabase.from('services').select('*').eq('active', true);
        return data || [];
    }
  });

  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!id
  });

  const { data: myTickets } = useQuery({
    queryKey: ['tenant-tickets', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('booking_id', id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // --- LOGICA ---
  const hasContactInfo = booking?.guest_phone && booking?.guest_email;
  const hasDocuments = documents && documents.length > 0;
  const isApproved = booking?.documents_approved === true;
  
  let currentStep = 1;
  if (hasContactInfo) currentStep = 2;
  if (hasContactInfo && hasDocuments) currentStep = 3; 
  if (isApproved) currentStep = 4; 

  const isCheckinUnlocked = currentStep === 4;
  const isPendingApproval = currentStep === 3;

  // --- AZIONI ---
  const saveContactInfo = async () => {
    if (!contactForm.email || !contactForm.phone) return;
    setIsSavingContact(true);
    try {
        await supabase.from('bookings').update({ guest_email: contactForm.email, guest_phone: contactForm.phone }).eq('id', id);
        toast({ title: "Contatti Salvati" });
        queryClient.invalidateQueries({ queryKey: ['tenant-booking'] });
    } catch (e) { toast({ title: "Errore", variant: "destructive" }); } 
    finally { setIsSavingContact(false); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;
      setIsUploading(true);
      const fileName = `doc_${booking.id}_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upError } = await supabase.storage.from('documents').upload(fileName, file);
      if (upError) throw upError;

      await supabase.from('booking_documents').insert({
        booking_id: booking.id, filename: file.name, file_url: fileName, status: 'in_revisione'
      });
      
      toast({ title: "Caricato!", description: "Documento in verifica." });
      queryClient.invalidateQueries({ queryKey: ['tenant-docs'] });
    } catch (error: any) { toast({ title: "Errore upload", variant: "destructive" }); } 
    finally { setIsUploading(false); }
  };

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      await supabase.from('tickets').insert({
        booking_id: booking.id, property_real_id: booking.property_id, titolo: ticketForm.titolo, descrizione: ticketForm.descrizione, stato: 'aperto', creato_da: 'ospite'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      toast({ title: "Richiesta inviata" });
      setTicketForm({ titolo: '', descrizione: '' });
    }
  });

  const sendPaymentNotice = useMutation({
      mutationFn: async () => {
          if (!booking || !paymentTicketOpen) return;
          await supabase.from('tickets').insert({
              booking_id: booking.id,
              property_real_id: booking.property_id,
              titolo: `Pagamento: ${paymentTicketOpen.tipo}`,
              descrizione: `L'inquilino prevede di pagare il ${format(new Date(payPromise.date), 'dd/MM/yyyy')} tramite ${payPromise.method}.`,
              stato: 'aperto',
              creato_da: 'ospite',
              related_payment_id: paymentTicketOpen.id,
              promised_payment_date: payPromise.date,
              promised_payment_method: payPromise.method
          });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
          toast({ title: "Amministrazione avvisata" });
          setPaymentTicketOpen(null);
          setPayPromise({ date: '', method: '' });
      }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", duration: 1500 });
  };

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  const downloadDoc = async (path: string) => {
    try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
        if (error) throw error;
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
        toast({ title: "Impossibile aprire", description: "File non trovato.", variant: "destructive" });
    }
  };

  if (isLoading || !booking) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/prop-manager-logo.svg" alt="Logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{booking.properties_real?.nome}</p>
             <p className="text-xs text-slate-500">Portale Ospite</p>
          </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">

        {/* TIMELINE */}
        <div className="flex justify-between items-center px-4 py-2 bg-white rounded-full border shadow-sm mx-2">
            {[{ s: 1, l: 'Contatti' }, { s: 2, l: 'Documenti' }, { s: 3, l: 'Verifica' }, { s: 4, l: 'Accesso' }].map((step) => (
                <div key={step.s} className="flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${currentStep >= step.s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                        {currentStep > step.s ? <CheckCircle className="w-4 h-4"/> : step.s}
                    </div>
                    <span className={`text-[9px] uppercase font-bold ${currentStep >= step.s ? 'text-slate-900' : 'text-slate-300'}`}>{step.l}</span>
                </div>
            ))}
        </div>

        {/* SMART CARD */}
        <Card className={`border-2 overflow-hidden shadow-lg transition-all duration-500 ${isCheckinUnlocked ? 'border-green-400 bg-white' : isPendingApproval ? 'border-yellow-400 bg-yellow-50' : 'border-red-200 bg-white'}`}>
            <CardHeader className="pb-2 border-b border-black/5">
                <CardTitle className="flex justify-between items-center text-lg">
                    {isCheckinUnlocked ? <span className="text-green-700">Accesso Attivo</span> : isPendingApproval ? <span className="text-yellow-700">Verifica in corso...</span> : <span className="text-red-700">Check-in Online</span>}
                    {isCheckinUnlocked ? <Unlock className="text-green-600 w-6 h-6"/> : isPendingApproval ? <Clock className="text-yellow-600 w-6 h-6"/> : <Lock className="text-red-500 w-6 h-6"/>}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                
                {currentStep === 1 && (
                    <div className="space-y-4 animate-in fade-in">
                        <p className="text-sm text-slate-600 text-center">Inserisci i tuoi recapiti per iniziare.</p>
                        <div className="space-y-3">
                            <div><Label className="text-xs uppercase text-slate-500">Email</Label><Input placeholder="tua@email.com" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
                            <div><Label className="text-xs uppercase text-slate-500">Telefono</Label><Input placeholder="+39 ..." value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} /></div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact}>{isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : "Avanti"}</Button>
                    </div>
                )}

                {(currentStep === 2 || currentStep === 3) && (
                    <div className="space-y-4 animate-in fade-in">
                          <div className="text-center mb-4">
                            {isPendingApproval ? (
                                <><ShieldCheck className="w-12 h-12 text-yellow-600 mx-auto mb-2"/><h3 className="font-bold text-yellow-900">Documenti ricevuti!</h3><p className="text-sm text-yellow-700">Stiamo controllando i documenti. Riceverai i codici a breve.</p></>
                            ) : (
                                <><UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-2"/><h3 className="font-bold text-slate-900">Carica i Documenti</h3><p className="text-sm text-slate-500">Carica foto del documento d'identità e contratto.</p></>
                            )}
                         </div>
                         {!isPendingApproval && (
                             <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                                <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                                {isUploading ? <Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-600"/> : <p className="text-blue-600 font-bold">Scatta Foto</p>}
                             </div>
                         )}
                         <div className="space-y-2">
                             {documents?.filter((d:any) => d.status === 'in_revisione').map((doc: any) => (
                                 <div key={doc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                     <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</span></div>
                                     <Badge variant="secondary">In Revisione</Badge>
                                 </div>
                             ))}
                         </div>
                    </div>
                )}

                {isCheckinUnlocked && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-4 text-center">
                             <div className="p-4 bg-slate-900 text-white rounded-xl">
                                <Key className="w-6 h-6 mx-auto mb-2 text-yellow-400"/>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Codice Keybox</p>
                                <p className="text-2xl font-mono font-bold tracking-widest">{booking.properties_real?.keybox_code || '---'}</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-xl cursor-pointer" onClick={() => copyToClipboard(booking.properties_real?.wifi_password || "")}>
                                <Wifi className="w-6 h-6 mx-auto mb-2 text-blue-500"/>
                                <p className="text-[10px] uppercase font-bold text-blue-400">WiFi</p>
                                <p className="text-lg font-bold text-blue-700 flex items-center justify-center gap-2">
                                    {booking.properties_real?.wifi_ssid ? 'Copia' : 'N/A'} <Copy className="w-3 h-3"/>
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {booking.properties_real?.checkin_video_url && (
                                <Button variant="outline" className="h-14" onClick={() => window.open(booking.properties_real.checkin_video_url, '_blank')}>
                                    <Youtube className="w-4 h-4 mr-2 text-red-600"/> Video
                                </Button>
                            )}
                            <Button variant="outline" className="h-14" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent((booking.properties_real?.indirizzo || '') + ' ' + (booking.properties_real?.citta || ''))}`, '_blank')}>
                                <MapPin className="w-4 h-4 mr-2 text-blue-600"/> Naviga
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* TABS (Visibili dopo sblocco o se ci sono dati) */}
        {(isCheckinUnlocked || payments?.length > 0 || myTickets?.length > 0) && (
            <Tabs defaultValue="experiences" className="w-full">
                <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="experiences" className="text-xs">Esperienze</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs">Extra</TabsTrigger>
                    <TabsTrigger value="docs" className="text-xs">Documenti</TabsTrigger>
                    <TabsTrigger value="support" className="text-xs">Help</TabsTrigger>
                </TabsList>
                
                {/* TAB ESPERIENZE (REINSERITA) */}
                <TabsContent value="experiences" className="space-y-4">
                    <div className="grid gap-3">
                        {services?.map((svc) => (
                            <Card key={svc.id} className="overflow-hidden border-0 shadow-md">
                                <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${svc.image_url || '/placeholder.svg'})` }} />
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg">{svc.title}</h3>
                                        <Badge className="bg-green-100 text-green-800">Consigliato</Badge>
                                    </div>
                                    <p className="text-sm text-slate-600 line-clamp-2">{svc.description}</p>
                                    <div className="mt-4 flex justify-between items-center">
                                        <span className="font-bold text-blue-600">€{svc.price}</span>
                                        <Button size="sm" onClick={() => {
                                            setTicketForm({ titolo: `Prenotazione: ${svc.title}`, descrizione: "Vorrei prenotare questa esperienza." });
                                            document.querySelector('[value="support"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                                        }}>Prenota</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {services?.length === 0 && <p className="text-center text-gray-400 py-8">Nessuna esperienza disponibile.</p>}
                    </div>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Spese Extra</CardTitle><CardDescription>Pulizie o servizi aggiuntivi.</CardDescription></CardHeader>
                        <CardContent>
                            {payments?.map((pay) => (
                                <div key={pay.id} className="flex justify-between items-center p-3 border-b last:border-0">
                                    <div><p className="font-medium capitalize">{pay.tipo?.replace('_', ' ')}</p><p className="text-xs text-gray-500">Scad: {format(new Date(pay.data_scadenza), 'dd MMM')}</p></div>
                                    <div className="text-right">
                                        <p className="font-bold">€{pay.importo}</p>
                                        {pay.stato === 'pagato' ? <Badge className="bg-green-100 text-green-800">Pagato</Badge> : 
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => setPaymentTicketOpen(pay)}>Avvisa</Button>
                                        }
                                    </div>
                                </div>
                            ))}
                            {payments?.length === 0 && <p className="text-center text-gray-400 py-4">Nessun extra.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB DOCUMENTI AGGIUNTA */}
                <TabsContent value="docs" className="space-y-4">
                     <Card>
                        <CardHeader><CardTitle>Documenti Condivisi</CardTitle><CardDescription>Contratti e info utili.</CardDescription></CardHeader>
                        <CardContent className="space-y-2">
                             {documents?.filter((d:any) => d.status !== 'in_revisione').map((doc: any) => (
                                 <div key={doc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                                     <div className="flex items-center gap-2 overflow-hidden">
                                         <FileText className="w-4 h-4 text-blue-500"/>
                                         <span className="text-sm truncate max-w-[180px]">{doc.filename}</span>
                                     </div>
                                     <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc.file_url)}>
                                         <Download className="w-4 h-4"/>
                                     </Button>
                                 </div>
                             ))}
                             {documents?.length === 0 && <p className="text-center text-gray-400 py-4">Nessun documento.</p>}
                        </CardContent>
                     </Card>
                </TabsContent>

                <TabsContent value="support" className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Chat con Host</CardTitle><CardDescription>Hai bisogno di aiuto?</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <Input placeholder="Oggetto" value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                            <Textarea placeholder="Scrivi qui..." value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} />
                            <Button className="w-full" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}><Send className="w-4 h-4 mr-2" /> Invia Messaggio</Button>
                        </CardContent>
                    </Card>
                    <div className="space-y-3">
                        {myTickets?.map(t => (
                            <div key={t.id} className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-2"><p className="font-medium">{t.titolo}</p><Badge variant={t.stato === 'risolto' ? 'default' : 'secondary'}>{t.stato}</Badge></div>
                                <p className="text-sm text-gray-600 mb-2">"{t.descrizione}"</p>
                                {t.admin_notes && <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md"><p className="text-xs font-bold text-blue-700 mb-1 flex items-center"><UserCog className="w-3 h-3 mr-1" /> Risposta Host:</p><p className="text-sm text-blue-900">{t.admin_notes}</p></div>}
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        )}

        {/* DIALOG PAGAMENTO */}
        <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>Avvisa Pagamento</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">Comunica all'amministrazione quando e come pagherai <strong>€{paymentTicketOpen?.importo}</strong> per {paymentTicketOpen?.tipo}.</p>
                    <div className="space-y-2"><Label>Data Prevista</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Metodo</Label><Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}><SelectTrigger><SelectValue placeholder="Seleziona..."/></SelectTrigger><SelectContent><SelectItem value="bonifico">Bonifico</SelectItem><SelectItem value="contanti">Contanti</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full">Invia Avviso</Button></DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}