import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, MapPin, Lock, Unlock, Youtube, Info, Copy, Loader2, 
  CheckCircle, FileText, CreditCard, Calendar, Download, Clock, ShieldCheck, UploadCloud
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function TenantPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // 1. DATI PRENOTAZIONE
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

  // --- LOGICA DI STATO ---
  const hasContactInfo = booking?.guest_phone && booking?.guest_email;
  const hasDocuments = documents && documents.length > 0;
  const isApproved = booking?.documents_approved === true;
  
  // Calcolo Step Corrente (1 a 4)
  let currentStep = 1;
  if (hasContactInfo) currentStep = 2;
  if (hasContactInfo && hasDocuments) currentStep = 3; // Fase Verifica
  if (hasContactInfo && hasDocuments && isApproved) currentStep = 4; // Fase Accesso

  // Variabili di comodo per la UI
  const isCheckinUnlocked = currentStep === 4;
  const isPendingApproval = currentStep === 3;

  // --- AZIONI ---

  const saveContactInfo = async () => {
    if (!contactForm.email || !contactForm.phone) return;
    setIsSavingContact(true);
    try {
        await supabase.from('bookings').update({ guest_email: contactForm.email, guest_phone: contactForm.phone }).eq('id', id);
        toast({ title: "Contatti Salvati", description: "Procedi con i documenti." });
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
      
      toast({ title: "Caricato!", description: "Documento aggiunto alla verifica." });
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
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{booking.properties_real?.nome}</p>
             <p className="text-xs text-slate-500">{booking.properties_real?.citta}</p>
          </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">

        {/* --- TIMELINE VISIVA --- */}
        <div className="flex justify-between items-center px-4 py-2 bg-white rounded-full border shadow-sm mx-2">
            {[
                { s: 1, l: 'Contatti' }, 
                { s: 2, l: 'Documenti' }, 
                { s: 3, l: 'Verifica' }, 
                { s: 4, l: 'Chiavi' }
            ].map((step) => (
                <div key={step.s} className="flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                        ${currentStep >= step.s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                        {currentStep > step.s ? <CheckCircle className="w-4 h-4"/> : step.s}
                    </div>
                    <span className={`text-[9px] uppercase font-bold ${currentStep >= step.s ? 'text-slate-900' : 'text-slate-300'}`}>
                        {step.l}
                    </span>
                </div>
            ))}
        </div>

        {/* --- SMART CARD --- */}
        <Card className={`border-2 overflow-hidden shadow-lg transition-all duration-500 
            ${isCheckinUnlocked ? 'border-green-400 bg-white' : 
              isPendingApproval ? 'border-yellow-400 bg-yellow-50' : 'border-red-200 bg-white'}`}>
            
            <CardHeader className="pb-2 border-b border-black/5">
                <CardTitle className="flex justify-between items-center text-lg">
                    {isCheckinUnlocked ? <span className="text-green-700">Accesso Sbloccato</span> : 
                     isPendingApproval ? <span className="text-yellow-700">Verifica in corso...</span> :
                     <span className="text-red-700">Check-in Richiesto</span>}
                    
                    {isCheckinUnlocked ? <Unlock className="text-green-600 w-6 h-6"/> : 
                     isPendingApproval ? <Clock className="text-yellow-600 w-6 h-6"/> :
                     <Lock className="text-red-500 w-6 h-6"/>}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                
                {/* STEP 1: CONTATTI */}
                {currentStep === 1 && (
                    <div className="space-y-4 animate-in fade-in">
                        <p className="text-sm text-slate-600 text-center">Inserisci i tuoi recapiti per iniziare.</p>
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs uppercase text-slate-500">Email</Label>
                                <Input placeholder="tua@email.com" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-slate-500">Telefono</Label>
                                <Input placeholder="+39 ..." value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
                            </div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact}>
                            {isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : "Salva e Procedi"}
                        </Button>
                    </div>
                )}

                {/* STEP 2 & 3: DOCUMENTI (Sia caricamento che attesa) */}
                {(currentStep === 2 || currentStep === 3) && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="text-center mb-4">
                            {isPendingApproval ? (
                                <>
                                    <ShieldCheck className="w-12 h-12 text-yellow-600 mx-auto mb-2"/>
                                    <h3 className="font-bold text-yellow-900">Documenti ricevuti!</h3>
                                    <p className="text-sm text-yellow-700">L'host sta controllando i file. Ti arriverà una notifica appena l'accesso sarà sbloccato.</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-2"/>
                                    <h3 className="font-bold text-slate-900">Carica i Documenti</h3>
                                    <p className="text-sm text-slate-500">Foto Fronte/Retro di Carta d'Identità e Codice Fiscale di tutti gli ospiti.</p>
                                </>
                            )}
                        </div>

                        {/* LISTA FILE CARICATI (SEMPRE VISIBILE) */}
                        {documents && documents.length > 0 && (
                            <div className="bg-white/80 rounded-lg border p-3 space-y-2">
                                <p className="text-[10px] uppercase font-bold text-slate-400">File Inviati:</p>
                                {documents.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-3 text-sm p-2 bg-white border rounded shadow-sm">
                                        <FileText className="w-4 h-4 text-blue-500"/>
                                        <span className="truncate flex-1 font-medium">{doc.filename}</span>
                                        <Badge variant="secondary" className="text-[10px] h-5">In Attesa</Badge>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* BOTTONE UPLOAD */}
                        <label className={`cursor-pointer w-full flex items-center justify-center gap-2 
                            ${isPendingApproval ? 'bg-white text-yellow-800 border-2 border-yellow-400 hover:bg-yellow-50' : 'bg-slate-900 text-white hover:bg-slate-800'} 
                            py-3 px-6 rounded-xl font-bold shadow-md transition-all active:scale-95`}>
                            {isUploading ? <Loader2 className="animate-spin w-5 h-5"/> : isPendingApproval ? "➕ Aggiungi altro file" : "📸 Carica Documento"}
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                    </div>
                )}

                {/* STEP 4: ACCESSO COMPLETATO */}
                {isCheckinUnlocked && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* KEYBOX */}
                        <div className="bg-green-50 border-2 border-green-100 p-6 rounded-2xl text-center relative">
                            <p className="text-xs text-green-800 uppercase font-bold tracking-widest mb-2">Il tuo Codice</p>
                            <div className="text-5xl font-mono font-black text-green-700 tracking-[0.2em] select-all">
                                {booking.properties_real?.keybox_code || "----"}
                            </div>
                        </div>

                        {/* VIDEO & MAPPE */}
                        <div className="grid grid-cols-2 gap-4">
                             {booking.properties_real?.checkin_video_url && (
                                 <Button variant="outline" className="h-20 flex flex-col gap-2 hover:border-red-400 hover:bg-red-50 group transition-all" 
                                    onClick={() => window.open(booking.properties_real.checkin_video_url, '_blank')}>
                                    <Youtube className="w-6 h-6 text-slate-400 group-hover:text-red-600" />
                                    <span className="text-xs font-bold text-slate-700">Video Guida</span>
                                 </Button>
                             )}
                             <Button variant="outline" className="h-20 flex flex-col gap-2 hover:border-blue-400 hover:bg-blue-50 group transition-all"
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((booking.properties_real?.via || '') + ' ' + (booking.properties_real?.citta || ''))}`, '_blank')}>
                                <MapPin className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                                <span className="text-xs font-bold text-slate-700">Posizione</span>
                             </Button>
                        </div>
                         
                         {/* WIFI */}
                         <div className="flex justify-between items-center p-4 bg-white rounded-xl border-2 border-slate-100 cursor-pointer active:scale-95 transition-transform" 
                             onClick={() => copyToClipboard(booking.properties_real?.wifi_password || "")}>
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Wifi className="w-5 h-5"/></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Wi-Fi Network</p>
                                    <p className="font-bold text-slate-800">{booking.properties_real?.wifi_ssid || "N/A"}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Password</p>
                                <code className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded text-slate-700 border">
                                    {booking.properties_real?.wifi_password || "N/A"}
                                </code>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* --- TABS PAGAMENTI (Semplificato) --- */}
        <div className="mt-8">
            <h3 className="font-bold text-slate-800 mb-4 ml-2">Pagamenti & Scadenze</h3>
            {payments?.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-xl border border-dashed text-slate-400 text-sm">
                    <CreditCard className="w-6 h-6 mx-auto mb-2 opacity-30"/>
                    Nessun pagamento in programma.
                </div>
            ) : (
                <div className="space-y-3">
                    {payments?.map(pay => (
                        <Card key={pay.id} className="border-l-4 border-l-slate-900 shadow-sm overflow-hidden">
                            <CardContent className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{pay.tipo === 'canone_locazione' ? 'Affitto' : 'Spese'}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                        <Calendar className="w-3 h-3"/> {format(new Date(pay.data_scadenza), 'dd MMM yyyy', { locale: it })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">€{pay.importo}</p>
                                    {pay.stato === 'pagato' ? <Badge className="bg-green-100 text-green-800 text-[10px] border-none">Pagato</Badge> : 
                                     pay.stato === 'in_verifica' ? <Badge className="bg-yellow-100 text-yellow-800 text-[10px] border-none">Verifica</Badge> : 
                                     <Button size="sm" variant="outline" className="mt-1 h-7 text-xs border-slate-200" onClick={() => markPaymentSent.mutate(pay.id)}>Segnala</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}