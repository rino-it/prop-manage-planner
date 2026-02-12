import React, { useState } from 'react';
import { useParams } from 'react-router-dom'; // <--- FONDAMENTALE PER IL LINK UNICO
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

export default function TenantPortal() {
  const { id } = useParams(); // Recupera l'UUID dal link
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({ titolo: '', descrizione: '', priorita: 'bassa' });
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });

  // 1. Recupero Booking tramite ID (Logica Link Unico)
  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`
            *,
            properties_real(id, nome, indirizzo, wifi_ssid, wifi_password)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
          console.error("Errore fetch booking:", error);
          throw error;
      }

      if (!bookingData) return null;

      // Fallback per proprietà mobile (veicolo)
      let mobileProp = null;
      if (!bookingData.properties_real && bookingData.property_mobile_id) {
          const { data: mp } = await supabase
            .from('properties_mobile')
            .select('id, veicolo, targa, immagine_url')
            .eq('id', bookingData.property_mobile_id)
            .maybeSingle();
          mobileProp = mp;
      }

      return { ...bookingData, properties_mobile: mobileProp };
    },
    enabled: !!id
  });

  const property = booking?.properties_real || booking?.properties_mobile;
  const isReal = !!booking?.properties_real;

  // 2. Pagamenti
  const { data: payments = [] } = useQuery({
    queryKey: ['tenant-payments', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', booking.id).order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!booking?.id
  });

  // 3. Ticket
  const { data: tickets = [] } = useQuery({
    queryKey: ['tenant-tickets', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await supabase.from('tickets').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking?.id
  });

  // 4. DOCUMENTI (NUOVO)
  const { data: documents = [] } = useQuery({
    queryKey: ['tenant-documents', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', booking.id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking?.id
  });

  // 5. SERVIZI (NUOVO)
  const { data: services = [] } = useQuery({
    queryKey: ['guest-services'],
    queryFn: async () => {
        try {
            const { data } = await supabase.from('services').select('*').eq('active', true);
            return data || [];
        } catch { return []; }
    }
  });

  // --- AZIONI ---

  const handleCreateTicket = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      const { error } = await supabase.from('tickets').insert({
        booking_id: booking.id,
        property_real_id: isReal ? property.id : null,
        property_mobile_id: !isReal ? property.id : null,
        titolo: ticketData.titolo,
        descrizione: ticketData.descrizione,
        priorita: ticketData.priorita,
        stato: 'aperto',
        creato_da: 'ospite'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      setNewTicketOpen(false);
      setTicketData({ titolo: '', descrizione: '', priorita: 'bassa' });
      toast({ title: "Segnalazione inviata" });
    }
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
              creato_da: 'ospite',
              related_payment_id: paymentTicketOpen.id
          });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
          toast({ title: "Amministrazione avvisata" });
          setPaymentTicketOpen(null);
      }
  });

  const downloadDoc = async (path: string) => {
    try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
        if (error || !data) throw new Error();
        window.open(data.signedUrl, '_blank');
    } catch {
        toast({ title: "Errore download", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", duration: 1500 });
  };

  if (bookingLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  if (!booking) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center bg-slate-50">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4"/>
        <h1 className="text-2xl font-bold text-slate-800">Link Non Valido</h1>
        <p className="text-slate-500 max-w-md mt-2">
            Non siamo riusciti a trovare la prenotazione associata a questo link. 
            Contatta l'amministratore per ricevere il link corretto.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg"><Home className="w-5 h-5 text-blue-600"/></div>
            <div>
                <h1 className="font-bold text-sm text-slate-900 truncate max-w-[150px]">{isReal ? property.nome : property?.veicolo}</h1>
                <p className="text-[10px] text-slate-500">Portale Inquilino</p>
            </div>
        </div>
        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Attivo</Badge>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
            <CardHeader>
                <CardTitle className="text-xl">Benvenuto, {booking.nome_ospite}</CardTitle>
                <CardDescription className="text-slate-400">Rimani aggiornato sulla tua locazione.</CardDescription>
            </CardHeader>
            {isReal && property?.wifi_password && (
                <CardFooter className="bg-white/5 border-t border-white/10">
                    <div className="flex justify-between items-center w-full py-1">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">WiFi Password</p>
                            <p className="text-sm font-mono">{property.wifi_password}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => copyToClipboard(property.wifi_password)}>
                            <Copy className="w-4 h-4"/>
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="status" className="text-xs">Stato</TabsTrigger>
                <TabsTrigger value="services" className="text-xs">Servizi</TabsTrigger>
                <TabsTrigger value="docs" className="text-xs">Documenti</TabsTrigger>
                <TabsTrigger value="support" className="text-xs">Help</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Euro className="w-4 h-4"/> Piano Pagamenti</h3>
                {payments.length === 0 ? <p className="text-center text-gray-400 py-8 bg-white rounded-lg border">Nessun pagamento registrato.</p> : (
                    <div className="space-y-3">
                        {payments.map((pay: any) => (
                            <Card key={pay.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="p-4 flex justify-between items-center">
                                    <div><p className="font-bold text-sm capitalize">{pay.tipo.replace('_', ' ')}</p><p className="text-xs text-gray-500">Scad: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p></div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg">€ {pay.importo}</p>
                                        {pay.stato === 'pagato' ? <Badge className="bg-green-100 text-green-700 border-0">Pagato</Badge> : 
                                            <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-200 text-orange-600" onClick={() => setPaymentTicketOpen(pay)}>Avvisa</Button>
                                        }
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="services" className="space-y-4">
                <h3 className="font-bold text-slate-700">Servizi Disponibili</h3>
                <div className="grid gap-3">
                    {services.map((svc: any) => (
                        <Card key={svc.id} className="overflow-hidden">
                            {svc.image_url && <img src={svc.image_url} className="h-32 w-full object-cover" />}
                            <CardContent className="p-4">
                                <h4 className="font-bold">{svc.title}</h4>
                                <p className="text-xs text-slate-500 mt-1">{svc.description}</p>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="font-bold text-blue-600 text-sm">€{svc.price}</span>
                                    <Button size="sm" onClick={() => { setNewTicketOpen(true); setTicketData({...ticketData, titolo: `Richiesta Servizio: ${svc.title}`}) }}>Richiedi</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {services.length === 0 && <p className="text-center text-gray-400 py-8">Nessun servizio extra disponibile.</p>}
                </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4">
                <h3 className="font-bold text-slate-700">Documenti Condivisi</h3>
                {documents.length === 0 ? <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-400"><FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-20"/><p>Nessun documento.</p></div> : (
                    <div className="grid gap-3">
                        {documents.map((doc: any) => (
                            <div key={doc.id} className="flex justify-between items-center p-3 bg-white rounded-lg border shadow-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-5 h-5 text-blue-500 shrink-0"/>
                                    <span className="text-sm font-medium truncate">{doc.filename}</span>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => downloadDoc(doc.file_url)}>
                                    <Download className="w-4 h-4 text-blue-600"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="support" className="space-y-4">
                <Button className="w-full bg-blue-600 shadow-md" onClick={() => setNewTicketOpen(true)}>
                    <Plus className="w-4 h-4 mr-2"/> Nuova Segnalazione
                </Button>
                <div className="space-y-3">
                    {tickets.map((ticket: any) => (
                        <Card key={ticket.id}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-sm">{ticket.titolo}</h4>
                                    <Badge variant="outline" className="text-[10px]">{ticket.stato}</Badge>
                                </div>
                                <p className="text-xs text-slate-600 mb-2">{ticket.descrizione}</p>
                                {ticket.admin_notes && (
                                    <div className="bg-blue-50 p-2 rounded border border-blue-100 text-[11px] text-blue-800">
                                        <strong>Staff:</strong> {ticket.admin_notes}
                                    </div>
                                )}
                                <p className="text-[9px] text-gray-400 text-right mt-1">{format(new Date(ticket.created_at), 'dd/MM/yyyy')}</p>
                            </CardContent>
                        </Card>
                    ))}
                    {tickets.length === 0 && <p className="text-center text-gray-400 py-8">Nessuna segnalazione aperta.</p>}
                </div>
            </TabsContent>
        </Tabs>
      </main>

      {/* DIALOG NUOVO TICKET */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>Nuova Segnalazione</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Oggetto</Label><Input placeholder="Es. Caldaia / Info affitto" value={ticketData.titolo} onChange={e => setTicketData({...ticketData, titolo: e.target.value})} /></div>
                <div className="space-y-2"><Label>Descrizione</Label><Textarea placeholder="Dettagli..." value={ticketData.descrizione} onChange={e => setTicketData({...ticketData, descrizione: e.target.value})} /></div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setNewTicketOpen(false)}>Annulla</Button>
                <Button onClick={() => handleCreateTicket.mutate()} className="bg-blue-600">Invia</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG AVVISO PAGAMENTO */}
      <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>Avvisa Pagamento</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">Dicci quando e come prevedi di pagare <strong>€{paymentTicketOpen?.importo}</strong>.</p>
                    <div className="space-y-2"><Label>Data Prevista</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-2">
                        <Label>Metodo</Label>
                        <Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}>
                            <SelectTrigger><SelectValue placeholder="Scegli..."/></SelectTrigger>
                            <SelectContent><SelectItem value="bonifico">Bonifico</SelectItem><SelectItem value="contanti">Contanti</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter><Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full">Invia Avviso</Button></DialogFooter>
            </DialogContent>
      </Dialog>
    </div>
  );
}