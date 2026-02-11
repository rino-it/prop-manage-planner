import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Home, FileText, Wrench, LogOut, Download, Euro, AlertTriangle, Plus, FileQuestion, Copy, UserCog, Utensils } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

export default function TenantPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({ titolo: '', descrizione: '', priorita: 'bassa' });
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });

  // 1. Sessione & Booking
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['tenant-session'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      
      const today = new Date().toISOString().split('T')[0];
      
      // FIX: Rimossa colonna 'immagine_url' che non esiste in properties_real
      // Se properties_mobile la possiede, la richiediamo solo lì.
      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
            *,
            properties_real(id, nome, indirizzo, wifi_ssid, wifi_password),
            properties_mobile(id, veicolo, targa, immagine_url)
        `)
        .eq('email', user.email)
        .lte('data_inizio', today)
        .gte('data_fine', today)
        .maybeSingle();

      if (error) console.error("Errore fetch booking:", error);
      return { user, booking };
    }
  });

  const booking = sessionData?.booking;
  const property = booking?.properties_real || booking?.properties_mobile;
  const isReal = !!booking?.properties_real;

  // 2. Pagamenti
  const { data: payments = [] } = useQuery({
    queryKey: ['tenant-payments', booking?.id],
    queryFn: async () => {
      if (!booking) return [];
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', booking.id).order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!booking
  });

  // 3. Ticket
  const { data: tickets = [] } = useQuery({
    queryKey: ['tenant-tickets', booking?.id],
    queryFn: async () => {
      if (!booking) return [];
      const { data } = await supabase.from('tickets').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking
  });

  // 4. Documenti
  const { data: documents = [] } = useQuery({
    queryKey: ['tenant-documents', booking?.id],
    queryFn: async () => {
      if (!booking) return [];
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', booking.id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking
  });

  // 5. Servizi (Gestione errore se tabella non esiste)
  const { data: services } = useQuery({
    queryKey: ['guest-services'],
    queryFn: async () => {
        try {
            const { data, error } = await supabase.from('services').select('*').eq('active', true);
            if (error) return []; // Ritorna array vuoto se errore (es. tabella mancante)
            return data || [];
        } catch { return []; }
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleCreateTicket = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("Nessuna prenotazione attiva");
      const { error } = await supabase.from('tickets').insert({
        booking_id: booking.id,
        user_id: sessionData?.user.id,
        property_real_id: isReal ? property.id : null,
        property_mobile_id: !isReal ? property.id : null,
        titolo: ticketData.titolo,
        descrizione: ticketData.descrizione,
        priorita: ticketData.priorita,
        stato: 'aperto',
        source: 'tenant_portal'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      setNewTicketOpen(false);
      setTicketData({ titolo: '', descrizione: '', priorita: 'bassa' });
      toast({ title: "Ticket inviato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const sendPaymentNotice = useMutation({
      mutationFn: async () => {
          if (!booking || !paymentTicketOpen) return;
          await supabase.from('tickets').insert({
              booking_id: booking.id,
              property_real_id: isReal ? property.id : null,
              titolo: `Pagamento: ${paymentTicketOpen.tipo}`,
              descrizione: `L'inquilino prevede di pagare il ${format(new Date(payPromise.date), 'dd/MM/yyyy')} tramite ${payPromise.method}.`,
              stato: 'aperto',
              source: 'tenant_portal',
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

  const downloadDoc = async (path: string) => {
    try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
        if (error) throw error;
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
        toast({ title: "Impossibile aprire", description: "File non trovato.", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!" });
  };

  if (sessionLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  if (!booking) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center bg-slate-50">
        <Home className="w-16 h-16 text-slate-300 mb-4"/>
        <h1 className="text-2xl font-bold text-slate-800">Nessuna Locazione Attiva</h1>
        <p className="text-slate-500 max-w-md mt-2">Non risultano contratti attivi per ({sessionData?.user.email}).</p>
        <Button variant="outline" className="mt-6" onClick={handleLogout}>Esci</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg"><Home className="w-5 h-5 text-blue-600"/></div>
            <div>
                <h1 className="font-bold text-sm sm:text-base text-slate-900 truncate max-w-[150px]">{isReal ? property.nome : property.veicolo}</h1>
                <p className="text-[10px] sm:text-xs text-slate-500 truncate">{isReal ? property.indirizzo : property.targa}</p>
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut className="w-5 h-5 text-slate-400"/></Button>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Ciao, {booking.nome_ospite.split(' ')[0]} 👋</CardTitle>
                <CardDescription className="text-blue-100">Scadenza contratto: <strong>{format(new Date(booking.data_fine), 'dd MMM yyyy')}</strong></CardDescription>
            </CardHeader>
            {isReal && property?.wifi_password && (
                <CardFooter>
                    <div className="bg-white/10 p-3 rounded-lg flex items-center gap-3 w-full cursor-pointer hover:bg-white/20 transition-colors" onClick={() => copyToClipboard(property.wifi_password)}>
                        <div className="bg-white p-2 rounded-full text-blue-600"><Home className="w-4 h-4"/></div>
                        <div className="flex-1"><p className="text-[10px] uppercase font-bold text-blue-200">WiFi Password</p><p className="font-mono font-bold text-sm">{property.wifi_password}</p></div>
                        <Copy className="w-4 h-4 text-white/50"/>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="status">Stato</TabsTrigger>
                <TabsTrigger value="services">Servizi</TabsTrigger>
                <TabsTrigger value="documents">Documenti</TabsTrigger>
                <TabsTrigger value="support">Assistenza</TabsTrigger>
            </TabsList>

            {/* TAB PAGAMENTI */}
            <TabsContent value="status" className="space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Euro className="w-5 h-5"/> Pagamenti</h3>
                {payments.length === 0 ? <p className="text-center text-gray-400 py-8 bg-white rounded-lg border">Tutto in regola!</p> : (
                    <div className="space-y-3">
                        {payments.map((pay: any) => {
                            const isOverdue = new Date(pay.data_scadenza) < new Date() && pay.stato !== 'pagato';
                            return (
                                <Card key={pay.id} className={`border-l-4 ${pay.stato === 'pagato' ? 'border-l-green-500' : isOverdue ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div><p className="font-bold text-sm capitalize">{pay.tipo.replace('_', ' ')}</p><p className="text-xs text-gray-500">Scad: {format(new Date(pay.data_scadenza), 'dd MMM')}</p>{isOverdue && <span className="text-[10px] text-red-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Scaduto</span>}</div>
                                        <div className="text-right"><p className="font-bold text-lg">€ {pay.importo}</p><Badge variant={pay.stato === 'pagato' ? 'default' : 'outline'} className={pay.stato === 'pagato' ? 'bg-green-100 text-green-700' : 'text-orange-600'}>{pay.stato === 'pagato' ? 'Pagato' : 'Da Pagare'}</Badge></div>
                                        {pay.stato !== 'pagato' && <Button size="sm" variant="outline" className="ml-2 h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => setPaymentTicketOpen(pay)}>Avvisa</Button>}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </TabsContent>

            {/* TAB SERVIZI */}
            <TabsContent value="services" className="space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Utensils className="w-5 h-5"/> Servizi Extra</h3>
                <div className="grid gap-3">
                    {services?.map((svc: any) => (
                        <Card key={svc.id} className="overflow-hidden border-0 shadow-md">
                            <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${svc.image_url || '/placeholder.svg'})` }} />
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg">{svc.title}</h3><Badge className="bg-green-100 text-green-800">Consigliato</Badge></div>
                                <p className="text-sm text-slate-600 line-clamp-2">{svc.description}</p>
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="font-bold text-blue-600">€{svc.price}</span>
                                    <Button size="sm" onClick={() => { setNewTicketOpen(true); setTicketData({ titolo: `Prenotazione: ${svc.title}`, descrizione: "Vorrei prenotare questo servizio.", priorita: 'bassa' }); }}>Prenota</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {services?.length === 0 && <p className="text-center text-gray-400 py-8">Nessun servizio disponibile.</p>}
                </div>
            </TabsContent>

            {/* TAB DOCUMENTI */}
            <TabsContent value="documents" className="space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-5 h-5"/> Documenti Condivisi</h3>
                {documents.length === 0 ? <div className="text-center py-12 bg-white rounded-lg border border-dashed"><FileQuestion className="w-10 h-10 text-slate-300 mx-auto mb-2"/><p className="text-slate-500">Nessun documento.</p></div> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {documents.map((doc: any) => (
                            <Card key={doc.id} className="hover:shadow-md transition-shadow group">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden"><div className="bg-slate-100 p-2 rounded text-slate-600"><FileText className="w-6 h-6"/></div><div className="min-w-0"><p className="font-semibold text-sm truncate" title={doc.filename}>{doc.filename}</p><p className="text-xs text-gray-400">{format(new Date(doc.uploaded_at), 'dd MMM')}</p></div></div>
                                    <Button size="icon" variant="ghost" onClick={() => downloadDoc(doc.file_url)}><Download className="w-4 h-4 text-blue-600"/></Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </TabsContent>

            {/* TAB ASSISTENZA */}
            <TabsContent value="support" className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Wrench className="w-5 h-5"/> Segnalazioni</h3><Button size="sm" onClick={() => setNewTicketOpen(true)} className="bg-blue-600"><Plus className="w-4 h-4 mr-2"/> Nuova</Button></div>
                <div className="space-y-3">
                    {tickets.length === 0 ? <p className="text-center text-gray-400 py-8 bg-white rounded-lg border">Nessuna segnalazione.</p> : (
                        tickets.map((ticket: any) => (
                            <Card key={ticket.id} className="bg-white">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-sm">{ticket.titolo}</h4><Badge variant="outline">{ticket.stato}</Badge></div>
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{ticket.descrizione}</p>
                                    {ticket.admin_notes && <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-2 border border-blue-100"><strong>Staff:</strong> {ticket.admin_notes}</div>}
                                    <p className="text-[10px] text-gray-400 text-right">{format(new Date(ticket.created_at), 'dd/MM HH:mm')}</p>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </main>

      {/* DIALOGS */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>Nuova Segnalazione</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Oggetto</Label><Input placeholder="Es. Caldaia" value={ticketData.titolo} onChange={e => setTicketData({...ticketData, titolo: e.target.value})} /></div>
                <div className="space-y-2"><Label>Descrizione</Label><Textarea placeholder="Dettagli..." value={ticketData.descrizione} onChange={e => setTicketData({...ticketData, descrizione: e.target.value})} /></div>
                <div className="space-y-2"><Label>Urgenza</Label><Select value={ticketData.priorita} onValueChange={(val) => setTicketData({...ticketData, priorita: val})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bassa">Bassa</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNewTicketOpen(false)}>Annulla</Button><Button onClick={() => handleCreateTicket.mutate()} className="bg-blue-600">Invia</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>Avvisa Pagamento</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">Comunica all'amministrazione quando e come pagherai <strong>€{paymentTicketOpen?.importo}</strong>.</p>
                    <div className="space-y-2"><Label>Data Prevista</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Metodo</Label><Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}><SelectTrigger><SelectValue placeholder="Seleziona..."/></SelectTrigger><SelectContent><SelectItem value="bonifico">Bonifico</SelectItem><SelectItem value="contanti">Contanti</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full">Invia Avviso</Button></DialogFooter>
            </DialogContent>
      </Dialog>
    </div>
  );
}