import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Home, Droplet, Zap, Euro, FileText, Upload, Send, CheckCircle, XCircle, Clock, Star, CreditCard, Ticket, UserCog, Mail, Phone, LogIn, ShieldCheck, IdCard, HeartPulse, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function TenantPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);
  
  // STATI PER IL GATE DI ACCESSO
  const [gateData, setGateData] = useState({ email: '', phone: '' });

  // 1. DATI CONTRATTO
  const { data: booking, isLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(*)').eq('id', id).single();
      return data;
    },
    enabled: !!id
  });

  // 2. DOCUMENTI
  const { data: documents } = useQuery({
    queryKey: ['tenant-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // Pre-fill dei dati se esistono
  useEffect(() => {
    if (booking) {
      setGateData({ email: booking.email_ospite || '', phone: booking.telefono_ospite || '' });
    }
  }, [booking]);

  // MUTATION: SALVA CONTATTI (STEP 1)
  const updateContacts = useMutation({
    mutationFn: async () => {
        if (!booking) return;
        const { error } = await supabase.from('bookings').update({ email_ospite: gateData.email, telefono_ospite: gateData.phone }).eq('id', booking.id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tenant-booking'] });
        toast({ title: "Contatti salvati", description: "Procedi con i documenti." });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // MUTATION: CARICA DOCUMENTI (STEP 2 e DASHBOARD)
  const handleFileUpload = async (file: File, type: string = 'generic') => {
    try {
      if (!booking) return;
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `tenant_${booking.id}_${type}_${Date.now()}.${fileExt}`;
      
      const { error: upError } = await supabase.storage.from('documents').upload(fileName, file);
      if (upError) throw upError;
      
      // Nomi specifici per riconoscere i documenti obbligatori
      const displayName = type === 'id' ? "Carta d'Identità" : type === 'health' ? "Tessera Sanitaria" : file.name;

      const { error: dbError } = await supabase.from('booking_documents').insert({
        booking_id: booking.id, 
        filename: displayName, 
        file_url: fileName, 
        status: 'in_revisione'
      });
      
      if (dbError) throw dbError;
      
      toast({ title: "Caricato!", description: `${displayName} aggiunto correttamente.` });
      queryClient.invalidateQueries({ queryKey: ['tenant-docs'] });
    } catch (error: any) { 
        toast({ title: "Errore", description: error.message, variant: "destructive" }); 
    } finally { 
        setUploading(false); 
    }
  };

  // 3. PAGAMENTI
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 4. SERVIZI
  const { data: services } = useQuery({
    queryKey: ['tenant-services', booking?.property_id],
    queryFn: async () => {
      if (!booking?.property_id) return [];
      const { data } = await supabase.from('services').select('*').eq('attivo', true);
      return (data || []).filter(s => !s.property_ids || s.property_ids.length === 0 || s.property_ids.includes(booking.property_id));
    },
    enabled: !!booking?.property_id
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

  // --- LOGICA DEL "TENANT GATE" ---
  const hasContacts = booking.email_ospite && booking.telefono_ospite;
  
  // Trova l'ULTIMO documento caricato per tipo (grazie all'ordinamento della query)
  const idDoc = documents?.find(doc => doc.filename.includes("Carta d'Identità"));
  const healthDoc = documents?.find(doc => doc.filename.includes("Tessera Sanitaria"));

  // È valido se esiste E NON è rifiutato
  const isIdValid = idDoc && idDoc.status !== 'rifiutato';
  const isHealthValid = healthDoc && healthDoc.status !== 'rifiutato';
  
  // Lo step è completo solo se entrambi sono validi
  const step2Completed = isIdValid && isHealthValid;

  // L'accesso finale richiede che almeno uno sia approvato (o logica più stretta se vuoi)
  const isApproved = documents?.some(d => d.status === 'approvato');

  // ==========================================
  // STEP 1: INSERIMENTO CONTATTI
  // ==========================================
  if (!hasContacts) {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-600 animate-in zoom-in-95 duration-300">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4"><Home className="w-8 h-8 text-blue-600" /></div>
                    <CardTitle className="text-xl">Benvenuto, {booking.nome_ospite}!</CardTitle>
                    <CardDescription>Per accedere alla tua area inquilino, conferma i tuoi recapiti.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2"><Label>Email</Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="pl-10" value={gateData.email} onChange={(e) => setGateData({...gateData, email: e.target.value})} placeholder="nome@email.com" /></div></div>
                    <div className="space-y-2"><Label>Telefono</Label><div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="pl-10" value={gateData.phone} onChange={(e) => setGateData({...gateData, phone: e.target.value})} placeholder="+39 333..." /></div></div>
                </CardContent>
                <CardFooter><Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => updateContacts.mutate()} disabled={!gateData.email || !gateData.phone}><LogIn className="w-4 h-4 mr-2" /> Salva e Continua</Button></CardFooter>
            </Card>
        </div>
    );
  }

  // ==========================================
  // STEP 2: CARICAMENTO DOCUMENTI OBBLIGATORI
  // ==========================================
  if (!step2Completed) {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-purple-600 animate-in zoom-in-95 duration-300">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4"><ShieldCheck className="w-8 h-8 text-purple-600" /></div>
                    <CardTitle>Identificazione</CardTitle>
                    <CardDescription>Carica i documenti richiesti per completare la registrazione.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {/* BOX 1: CARTA D'IDENTITÀ */}
                    <div className={`p-4 border rounded-lg transition-all ${isIdValid ? 'bg-green-50 border-green-200' : idDoc?.status === 'rifiutato' ? 'bg-red-50 border-red-200' : 'bg-white border-dashed border-gray-300'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <Label className="flex items-center gap-2 font-bold text-gray-700">
                                <IdCard className="w-4 h-4 text-purple-600" /> Carta d'Identità
                            </Label>
                            {isIdValid ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Caricato</Badge> : idDoc?.status === 'rifiutato' ? <Badge className="bg-red-100 text-red-700">Rifiutato</Badge> : <Badge variant="outline">Mancante</Badge>}
                        </div>
                        
                        {/* Mostra bottone se MANCANTE o RIFIUTATO */}
                        {(!isIdValid) && (
                            <>
                                {idDoc?.status === 'rifiutato' && <p className="text-xs text-red-600 mb-2 font-medium flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Documento non valido. Ricarica:</p>}
                                <label className="cursor-pointer flex items-center justify-center w-full h-12 bg-purple-50 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-100 transition-colors">
                                    {uploading ? 'Caricamento...' : 'Seleziona File'}
                                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'id')} disabled={uploading} />
                                </label>
                            </>
                        )}
                        {isIdValid && <p className="text-xs text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> File ricevuto</p>}
                    </div>

                    {/* BOX 2: TESSERA SANITARIA */}
                    <div className={`p-4 border rounded-lg transition-all ${isHealthValid ? 'bg-green-50 border-green-200' : healthDoc?.status === 'rifiutato' ? 'bg-red-50 border-red-200' : 'bg-white border-dashed border-gray-300'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <Label className="flex items-center gap-2 font-bold text-gray-700">
                                <HeartPulse className="w-4 h-4 text-red-500" /> Tessera Sanitaria
                            </Label>
                            {isHealthValid ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Caricato</Badge> : healthDoc?.status === 'rifiutato' ? <Badge className="bg-red-100 text-red-700">Rifiutato</Badge> : <Badge variant="outline">Mancante</Badge>}
                        </div>

                        {(!isHealthValid) && (
                            <>
                                {healthDoc?.status === 'rifiutato' && <p className="text-xs text-red-600 mb-2 font-medium flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Documento non valido. Ricarica:</p>}
                                <label className="cursor-pointer flex items-center justify-center w-full h-12 bg-red-50 text-red-700 rounded-md text-xs font-medium hover:bg-red-100 transition-colors">
                                    {uploading ? 'Caricamento...' : 'Seleziona File'}
                                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'health')} disabled={uploading} />
                                </label>
                            </>
                        )}
                        {isHealthValid && <p className="text-xs text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> File ricevuto</p>}
                    </div>

                </CardContent>
                <CardFooter>
                    <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700" 
                        onClick={() => window.location.reload()} 
                        disabled={!step2Completed}
                    >
                        {step2Completed ? "Completa Registrazione" : "Carica tutto per procedere"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  // ==========================================
  // STEP 3: ATTESA APPROVAZIONE (Gate Finale)
  // ==========================================
  if (!isApproved) {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-yellow-500 animate-in zoom-in-95 duration-300">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4"><Clock className="w-8 h-8 text-yellow-600" /></div>
                    <CardTitle>Verifica in Corso</CardTitle>
                    <CardDescription>Grazie! I tuoi documenti sono stati ricevuti.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border"><IdCard className="w-4 h-4 text-purple-600"/><span className="text-sm">Carta d'Identità</span><Badge className="ml-auto bg-yellow-100 text-yellow-700">Ok</Badge></div>
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border"><HeartPulse className="w-4 h-4 text-red-600"/><span className="text-sm">Tessera Sanitaria</span><Badge className="ml-auto bg-yellow-100 text-yellow-700">Ok</Badge></div>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                        Lo staff verificherà la documentazione a breve.<br/>
                        Una volta approvati, avrai accesso completo a questa pagina.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
  }

  // ==========================================
  // DASHBOARD COMPLETA (Accesso Garantito)
  // ==========================================
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
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
                                {service.immagine_url ? <img src={service.immagine_url} alt={service.titolo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText className="w-10 h-10" /></div>}
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
                    <div key={t.id} className="bg-white p-4 rounded-lg border flex justify-between items-center">
                        <div className="flex-1">
                            <p className="font-medium">{t.titolo}</p>
                            <p className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd MMM')}</p>
                        </div>
                        <Badge>{t.stato}</Badge>
                    </div>
                ))}
            </div>
        </TabsContent>

        <TabsContent value="docs">
           <Card className="mb-6"><CardContent className="py-8 text-center"><h3 className="font-bold text-gray-900 mb-4">Carica Documenti Extra</h3><label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white h-10 px-6 py-2">{uploading ? "Caricamento..." : "Seleziona File"}<input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={uploading} /></label></CardContent></Card>
           <div className="space-y-3">{documents?.map(doc => (<div key={doc.id} className="bg-white p-4 rounded-lg border flex justify-between items-center"><div className="flex items-center gap-3"><FileText className="w-5 h-5" /><span className="font-medium text-sm">{doc.filename}</span></div>{getStatusBadge(doc.status)}</div>))}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}