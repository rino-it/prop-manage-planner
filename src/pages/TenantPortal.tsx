import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, MapPin, Lock, Unlock, Youtube, Send, Info, Copy, Loader2, 
  CheckCircle, User, Phone, Mail, FileText, CreditCard, Calendar, Download, Clock, ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function TenantPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // 1. DATI PRENOTAZIONE
  const { data: booking, isLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, properties_real(*)')
        .eq('id', id)
        .single();
      return data;
    },
    enabled: !!id
  });

  // 2. DOCUMENTI
  const { data: documents } = useQuery({
    queryKey: ['tenant-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 3. PAGAMENTI
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!id
  });

  // --- LOGICA DI SICUREZZA ---
  const hasContactInfo = booking?.guest_phone && booking?.guest_email;
  const hasDocuments = documents && documents.length > 0;
  const isApproved = booking?.documents_approved === true; // NUOVO: Deve essere approvato dall'host
  
  // L'accesso è sbloccato SOLO SE: Ha contatti + Ha documenti + È approvato
  const isCheckinUnlocked = hasContactInfo && hasDocuments && isApproved;
  const isPendingApproval = hasContactInfo && hasDocuments && !isApproved;

  // --- AZIONI ---

  const saveContactInfo = async () => {
    if (!contactForm.email || !contactForm.phone) return;
    setIsSavingContact(true);
    try {
        await supabase.from('bookings').update({ guest_email: contactForm.email, guest_phone: contactForm.phone }).eq('id', id);
        toast({ title: "Contatti Salvati", description: "Procedi con il caricamento documenti." });
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

      // NOTA: Non settiamo più 'online_checkin_completed' a true automaticamente o l'accesso.
      // Lasciamo che sia l'host a decidere.
      
      toast({ title: "Documento Inviato", description: "In attesa di verifica dell'Host." });
      queryClient.invalidateQueries({ queryKey: ['tenant-docs'] });
    } catch (error: any) { toast({ title: "Errore upload", variant: "destructive" }); } 
    finally { setIsUploading(false); }
  };

  const markPaymentSent = useMutation({
    mutationFn: async (paymentId: string) => {
        await supabase.from('tenant_payments').update({ stato: 'in_verifica', payment_date_declared: new Date().toISOString() }).eq('id', paymentId);
    },
    onSuccess: () => {
        toast({ title: "Segnalato", description: "Verificheremo l'incasso." });
        queryClient.invalidateQueries({ queryKey: ['tenant-payments'] });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", duration: 1500 });
  };

  if (isLoading || !booking) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/prop-manager-logo.svg" alt="Logo" className="h-8 w-auto object-contain" />
             <span className="font-bold text-slate-800 hidden sm:block">Portale Ospiti</span>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{booking.properties_real?.nome}</p>
             <p className="text-xs text-slate-500">{booking.properties_real?.citta}</p>
          </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">

        {/* --- CARD DI ACCESSO (SMART LOCK) --- */}
        <Card className={`border overflow-hidden shadow-md transition-all duration-500 
            ${isCheckinUnlocked ? 'border-green-200 bg-white' : 
              isPendingApproval ? 'border-yellow-300 bg-yellow-50' : 'border-red-200 bg-white'}`}>
            
            <div className={`h-2 w-full transition-colors duration-500 
                ${isCheckinUnlocked ? 'bg-green-500' : isPendingApproval ? 'bg-yellow-400' : 'bg-red-500'}`} />
            
            <CardHeader className="pb-2 bg-slate-50/50">
                <CardTitle className="flex justify-between items-center text-lg">
                    {isCheckinUnlocked ? <span className="text-green-800">Accesso Autorizzato</span> : 
                     isPendingApproval ? <span className="text-yellow-800">Verifica in Corso</span> :
                     <span className="text-red-800">Check-in Richiesto</span>}
                    
                    {isCheckinUnlocked ? <Unlock className="text-green-600 w-5 h-5"/> : 
                     isPendingApproval ? <Clock className="text-yellow-600 w-5 h-5"/> :
                     <Lock className="text-red-500 w-5 h-5"/>}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
                
                {/* FASE 0: CONTATTI */}
                {!hasContactInfo && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 flex gap-2">
                            <Info className="w-5 h-5 flex-shrink-0"/>
                            <div>Per ragioni di sicurezza, inserisci i tuoi contatti validi.</div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Email Personale</Label>
                                <Input placeholder="email@esempio.com" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <Label>Cellulare</Label>
                                <Input placeholder="+39 ..." value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
                            </div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact}>
                            {isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : "Salva e Procedi"}
                        </Button>
                    </div>
                )}

                {/* FASE 1: UPLOAD DOCUMENTI */}
                {hasContactInfo && !isCheckinUnlocked && (
                    <div className="space-y-4 animate-in fade-in">
                        {!isPendingApproval && (
                             <div className="flex items-center gap-2 justify-center text-green-700 font-bold bg-green-50 py-1 px-3 rounded-full text-xs w-fit mx-auto mb-2">
                                <CheckCircle className="w-3 h-3"/> Contatti Ricevuti
                            </div>
                        )}

                        <div className={`p-4 rounded-xl text-center border-2 border-dashed 
                            ${isPendingApproval ? 'border-yellow-300 bg-yellow-50/50' : 'border-slate-200 bg-slate-50'}`}>
                            
                            {isPendingApproval ? (
                                <div className="py-2">
                                    <ShieldCheck className="w-12 h-12 text-yellow-500 mx-auto mb-2"/>
                                    <h3 className="font-bold text-yellow-800">Documenti inviati!</h3>
                                    <p className="text-sm text-yellow-700 mt-1">
                                        Stiamo verificando la tua identità.<br/>
                                        Riceverai una notifica o l'accesso verrà sbloccato qui a breve.
                                    </p>
                                    <p className="text-xs text-yellow-600 mt-4 italic">Hai dimenticato qualcosa? Puoi caricare altri file.</p>
                                </div>
                            ) : (
                                <div className="py-2">
                                    <p className="font-medium text-slate-800 mb-1">Caricamento Documenti Obbligatorio</p>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Carica foto fronte/retro di: <br/>
                                        <strong>1. Carta d'Identità</strong> <br/>
                                        <strong>2. Tessera Sanitaria / Codice Fiscale</strong>
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-center mt-2">
                                <label className={`cursor-pointer w-full max-w-xs flex items-center justify-center gap-2 
                                    ${isPendingApproval ? 'bg-white text-yellow-700 border border-yellow-300' : 'bg-slate-900 text-white'} 
                                    hover:opacity-90 py-3 px-6 rounded-xl font-bold shadow-sm transition-all active:scale-95`}>
                                    {isUploading ? <Loader2 className="animate-spin w-5 h-5"/> : isPendingApproval ? "➕ Aggiungi altro file" : "📸 Scatta/Carica Foto"}
                                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* FASE 2: ACCESSO SBLOCCATO (Solo dopo approvazione) */}
                {isCheckinUnlocked && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center shadow-sm relative overflow-hidden">
                            <p className="text-xs text-green-800 uppercase font-bold tracking-widest mb-1">Codice Cassetta</p>
                            <div className="text-4xl font-mono font-black text-green-700 tracking-widest select-all">
                                {booking.properties_real?.keybox_code || "----"}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                             {booking.properties_real?.checkin_video_url && (
                                 <Button variant="outline" className="h-auto py-3 flex flex-col gap-1 hover:bg-red-50 hover:border-red-200 group transition-all" 
                                    onClick={() => window.open(booking.properties_real.checkin_video_url, '_blank')}>
                                    <Youtube className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
                                    <span className="text-xs font-medium text-slate-600">Video</span>
                                 </Button>
                             )}
                             <Button variant="outline" className="h-auto py-3 flex flex-col gap-1 hover:bg-blue-50 hover:border-blue-200 group transition-all"
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((booking.properties_real?.via || '') + ' ' + (booking.properties_real?.citta || ''))}`, '_blank')}>
                                <MapPin className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                                <span className="text-xs font-medium text-slate-600">Mappa</span>
                             </Button>
                        </div>
                         
                         {/* WIFI */}
                         <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm" 
                             onClick={() => copyToClipboard(booking.properties_real?.wifi_password || "")}>
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-full text-blue-600"><Wifi className="w-4 h-4"/></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Wi-Fi</p>
                                    <p className="font-bold text-slate-800 text-sm">{booking.properties_real?.wifi_ssid || "N/A"}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <code className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 border">
                                    {booking.properties_real?.wifi_password || "N/A"}
                                </code>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* --- TABS: PAGAMENTI & STORICO DOCUMENTI --- */}
        <Tabs defaultValue="payments" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="payments">💰 Pagamenti</TabsTrigger>
                <TabsTrigger value="documents">📂 I Miei File</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="space-y-3">
                {payments?.length === 0 ? (
                    <div className="text-center p-6 bg-white rounded-lg border border-dashed text-slate-400 text-sm">
                        <CreditCard className="w-6 h-6 mx-auto mb-2 opacity-30"/>
                        Nessun pagamento in programma.
                    </div>
                ) : (
                    payments?.map(pay => (
                        <Card key={pay.id} className="border-l-4 border-l-blue-500 shadow-sm">
                            <CardContent className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{pay.tipo === 'canone_locazione' ? 'Canone Affitto' : 'Rimborso Spese'}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3"/> Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM', { locale: it })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">€{pay.importo}</p>
                                    {pay.stato === 'pagato' ? (
                                        <Badge className="bg-green-100 text-green-800 text-[10px]">Pagato</Badge>
                                    ) : pay.stato === 'in_verifica' ? (
                                        <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Verifica</Badge>
                                    ) : (
                                        <Button size="sm" variant="outline" className="mt-1 h-7 text-xs border-blue-200 text-blue-700" 
                                            onClick={() => markPaymentSent.mutate(pay.id)}>
                                            Segnala
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-3">
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold">File Caricati</CardTitle></CardHeader>
                    <CardContent className="grid gap-2">
                        {documents?.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border text-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                    <span className="truncate max-w-[150px]">{doc.filename}</span>
                                </div>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => window.open(`https://pcikhldamcqvirwkokim.supabase.co/storage/v1/object/public/documents/${doc.file_url}`, '_blank')}>
                                    <Download className="w-3 h-3"/>
                                </Button>
                            </div>
                        ))}
                        {documents?.length === 0 && <p className="text-center text-slate-400 text-xs py-2">Nessun documento.</p>}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {/* --- ASSISTENZA --- */}
        <div className="pt-4 pb-8">
            <h3 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide ml-1">Assistenza</h3>
            <div className="flex gap-2">
                <Input className="bg-white border-slate-200" placeholder="Messaggio..." value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                <Button className="bg-slate-900 text-white px-4" onClick={() => toast({ title: "Inviato", description: "Ti risponderemo presto." })} disabled={!ticketForm.titolo}>
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>

      </div>
    </div>
  );
}