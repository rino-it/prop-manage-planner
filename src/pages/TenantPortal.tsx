import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Home, Droplet, Zap, Euro, FileText, Upload, Send, CheckCircle, XCircle, Clock, Star, CreditCard, Ticket, ExternalLink, Image as ImageIcon, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function TenantPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);

  // 1. DATI CONTRATTO
  const { data: booking, isLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(*)').eq('id', id).single();
      return data;
    },
    enabled: !!id
  });

  // 2. PAGAMENTI
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 3. SERVIZI
  const { data: services } = useQuery({
    queryKey: ['tenant-services', booking?.property_id],
    queryFn: async () => {
      if (!booking?.property_id) return [];
      const { data } = await supabase.from('services').select('*').eq('attivo', true);
      // Filtro context-aware
      return (data || []).filter(s => !s.property_ids || s.property_ids.length === 0 || s.property_ids.includes(booking.property_id));
    },
    enabled: !!booking?.property_id
  });

  // 4. DOCUMENTI
  const { data: documents } = useQuery({
    queryKey: ['tenant-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 5. TICKET
  const { data: myTickets } = useQuery({
      queryKey: ['tenant-tickets', id],
      queryFn: async () => {
          const { data } = await supabase.from('tickets').select('*').eq('booking_id', id).order('created_at', { ascending: false });
          return data || [];
      },
      enabled: !!id
  });

  // AZIONI
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `doc_${booking.id}_${Date.now()}.${fileExt}`;
      const { error: upError } = await supabase.storage.from('documents').upload(fileName, file);
      if (upError) throw upError;
      const { error: dbError } = await supabase.from('booking_documents').insert({
        booking_id: booking.id, filename: file.name, file_url: fileName, status: 'in_revisione'
      });
      if (dbError) throw dbError;
      toast({ title: "Caricato!", description: "In attesa di approvazione." });
      queryClient.invalidateQueries({ queryKey: ['tenant-docs'] });
    } catch (error: any) { toast({ title: "Errore", description: error.message, variant: "destructive" }); } finally { setUploading(false); }
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
        toast({ title: "Ticket inviato" });
        setTicketForm({ titolo: '', descrizione: '' });
      }
  });

  const handleVoucherDownload = (serviceTitle: string) => {
    alert(`[SIMULAZIONE PDF]\n\nSconto Inquilino: ${serviceTitle}\nPer: ${booking.nome_ospite}`);
  };

  if (isLoading || !booking) return <div className="p-8 text-center">Caricamento portale...</div>;
  const daPagare = payments?.filter(p => p.stato === 'da_pagare').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;

  const getStatusBadge = (status: string) => {
      if (status === 'approvato') return <Badge className="bg-green-100 text-green-700">Approvato</Badge>;
      if (status === 'rifiutato') return <Badge className="bg-red-100 text-red-700">Rifiutato</Badge>;
      return <Badge className="bg-yellow-100 text-yellow-700">In Attesa</Badge>;
  };

  const getIcon = (tipo: string) => {
    if (tipo === 'bolletta_luce') return <Zap className="w-5 h-5 text-yellow-600" />;
    if (tipo === 'bolletta_gas' || tipo === 'acqua') return <Droplet className="w-5 h-5 text-blue-600" />;
    return <Home className="w-5 h-5 text-purple-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div><h1 className="text-2xl font-bold text-gray-900">Ciao, {booking.nome_ospite}</h1><p className="text-gray-500 flex items-center gap-2 mt-1"><Home className="w-4 h-4" /> {booking.properties_real?.nome}</p></div>
        <div className={`px-6 py-3 rounded-lg border text-center min-w-[200px] ${daPagare > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}><p className="text-xs uppercase font-bold text-gray-500 mb-1">Da Saldare</p><p className={`text-2xl font-bold ${daPagare > 0 ? 'text-orange-600' : 'text-green-600'}`}>€ {daPagare.toLocaleString()}</p></div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="payments">Pagamenti</TabsTrigger>
          <TabsTrigger value="services">Esperienze</TabsTrigger>
          <TabsTrigger value="support">Assistenza</TabsTrigger>
          <TabsTrigger value="docs">Documenti</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          {payments?.map((pay) => (
            <Card key={pay.id} className="border-l-4 overflow-hidden" style={{ borderLeftColor: pay.stato === 'pagato' ? '#22c55e' : '#f97316' }}>
              <CardContent className="p-0">
                <div className="flex items-center p-4">
                  <div className="p-3 bg-gray-100 rounded-full mr-4">{getIcon(pay.tipo || '')}</div>
                  <div className="flex-1"><p className="font-bold capitalize text-gray-900">{pay.tipo?.replace('_', ' ') || 'Rata'}</p><p className="text-sm text-gray-500">{pay.description}</p><p className="text-xs text-gray-400">Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p></div>
                  <div className="text-right"><p className="font-bold text-lg">€{pay.importo}</p><Badge variant={pay.stato === 'pagato' ? 'default' : 'outline'}>{pay.stato}</Badge></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                {services?.map(service => {
                    const isPremium = !!service.payment_link;
                    return (
                        <Card key={service.id} className={`overflow-hidden border-l-4 transition-shadow hover:shadow-md flex flex-col ${isPremium ? 'border-l-yellow-400' : 'border-l-green-500'}`}>
                            <div className="h-32 bg-gray-100 relative">
                                {service.immagine_url ? <img src={service.immagine_url} alt={service.titolo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10" /></div>}
                                <div className="absolute top-2 right-2">{isPremium ? <Badge className="bg-yellow-400 text-yellow-900">Premium</Badge> : <Badge className="bg-green-500">Partner</Badge>}</div>
                            </div>
                            <CardHeader className="pb-2"><CardTitle className="text-lg flex justify-between">{service.titolo} <span className="text-base font-bold">€ {service.prezzo}</span></CardTitle><CardDescription className="line-clamp-2">{service.descrizione}</CardDescription></CardHeader>
                            <CardFooter className="mt-auto pt-0">
                                {isPremium ? <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold" onClick={() => window.open(service.payment_link, '_blank')}><CreditCard className="w-4 h-4 mr-2" /> Prenota</Button> : <Button variant="outline" className="w-full border-green-500 text-green-600" onClick={() => handleVoucherDownload(service.titolo)}><Ticket className="w-4 h-4 mr-2" /> Voucher</Button>}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
            <Card><CardHeader><CardTitle>Segnala Problema</CardTitle></CardHeader><CardContent className="space-y-4"><Input placeholder="Oggetto" value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} /><Textarea placeholder="Descrizione..." value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} /><Button className="w-full" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}><Send className="w-4 h-4 mr-2" /> Invia</Button></CardContent></Card>
            <div className="space-y-3">
                {myTickets?.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <div><p className="font-medium text-gray-900">{t.titolo}</p><p className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd MMM')}</p></div>
                            <Badge variant={t.stato === 'risolto' ? 'default' : 'secondary'}>{t.stato}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2">"{t.descrizione}"</p>
                        
                        {/* NOTE CONDIVISE */}
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
           <Card className="mb-6"><CardContent className="py-8 text-center"><h3 className="font-bold text-gray-900 mb-4">Carica Documenti</h3><label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white h-10 px-6 py-2">{uploading ? "Caricamento..." : "Seleziona File"}<input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} /></label></CardContent></Card>
           <div className="space-y-3">{documents?.map(doc => (<div key={doc.id} className="bg-white p-4 rounded-lg border flex justify-between items-center"><div className="flex items-center gap-3"><FileText className="w-5 h-5" /><span className="font-medium text-sm">{doc.filename}</span></div>{getStatusBadge(doc.status)}</div>))}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}