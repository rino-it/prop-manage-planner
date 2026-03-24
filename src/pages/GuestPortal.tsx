import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  CheckCircle, FileText, Clock, ShieldCheck, UploadCloud, Send, UserCog, Download, Key, ExternalLink, Ticket, MessageCircle, CreditCard, Receipt
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import LanguagePicker from '@/components/LanguagePicker';
import T from '@/components/TranslatedText';
import { compressImage, isImageFile } from '@/utils/imageCompression';
import { validateEmail, suggestEmailCorrection } from '@/utils/emailValidation';
import { OcrDocumentUpload } from '@/components/OcrDocumentUpload';

export default function GuestPortal() {
  return (
    <LanguageProvider>
      <GuestPortalInner />
    </LanguageProvider>
  );
}

function GuestPortalInner() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('experiences');
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [serviceDetailOpen, setServiceDetailOpen] = useState<any>(null);
  const [serviceMessage, setServiceMessage] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [loadingPaymentId, setLoadingPaymentId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const handleGuestEmailChange = (email: string) => {
    setContactForm({ ...contactForm, email });
    const validation = validateEmail(email);
    setEmailError(email.length > 0 && !validation.valid ? (validation.error || null) : null);
    setEmailSuggestion(suggestEmailCorrection(email));
  };

  const handlePayNow = async (paymentId: string) => {
    setLoadingPaymentId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: { payment_id: paymentId }
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e: any) {
      toast({ title: t('toast.error') || 'Errore', description: e.message, variant: 'destructive' });
      setLoadingPaymentId(null);
    }
  };

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

  const { data: services } = useQuery({
    queryKey: ['guest-services', booking?.property_id],
    queryFn: async () => {
        if (!booking?.property_id) return [];
        const { data } = await supabase.from('services').select('*').eq('attivo', true).contains('property_ids', [booking.property_id]);
        return data || [];
    },
    enabled: !!booking?.property_id
  });

  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!id,
    refetchInterval: 30000
  });

  const { data: myTickets } = useQuery({
    queryKey: ['tenant-tickets', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('booking_id', id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (!paymentStatus) return;

    if (paymentStatus === 'success') {
      setActiveTab('payments');
      queryClient.invalidateQueries({ queryKey: ['tenant-payments', id] });
      toast({
        title: t('toast.paymentSuccess') || 'Pagamento completato',
        description: t('toast.paymentSuccessDesc') || 'Il pagamento e stato elaborato correttamente.',
      });
    } else if (paymentStatus === 'cancelled') {
      setActiveTab('payments');
      toast({
        title: t('toast.paymentCancelled') || 'Pagamento annullato',
        description: t('toast.paymentCancelledDesc') || 'Il pagamento non e stato completato.',
        variant: 'destructive',
      });
    }

    searchParams.delete('payment');
    setSearchParams(searchParams, { replace: true });
  }, []);

  // --- LOGICA ---
  const hasContactInfo = booking?.telefono_ospite && booking?.email_ospite;
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
        const { error } = await supabase.from('bookings').update({ email_ospite: contactForm.email, telefono_ospite: contactForm.phone }).eq('id', id);
        if (error) throw error;
        toast({ title: t('toast.contactsSaved') });
        queryClient.invalidateQueries({ queryKey: ['tenant-booking'] });
    } catch (e) { toast({ title: t('toast.error'), variant: "destructive" }); }
    finally { setIsSavingContact(false); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;

      if (file.size > 10 * 1024 * 1024) {
        toast({ title: t('toast.fileTooLarge'), description: t('toast.fileTooLargeDesc'), variant: "destructive" });
        return;
      }

      setIsUploading(true);
      const processedFile = isImageFile(file) ? await compressImage(file) : file;
      const fileName = `doc_${booking.id}_${Date.now()}.${processedFile.name.split('.').pop()}`;
      const { error: upError } = await supabase.storage.from('documents').upload(fileName, processedFile);
      if (upError) throw upError;

      const { error: dbError } = await supabase.from('booking_documents').insert({
        booking_id: booking.id, filename: file.name, file_url: fileName, status: 'in_revisione'
      });
      if (dbError) throw dbError;

      toast({ title: t('toast.uploaded'), description: t('toast.uploadedDesc') });
      queryClient.invalidateQueries({ queryKey: ['tenant-docs'] });
    } catch (error: any) { toast({ title: t('toast.uploadError'), variant: "destructive" }); }
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
      toast({ title: t('toast.requestSent') });
      setTicketForm({ titolo: '', descrizione: '' });
    }
  });

  const sendServiceContact = useMutation({
    mutationFn: async () => {
      if (!booking || !serviceDetailOpen) return;
      await supabase.from('tickets').insert({
        booking_id: booking.id,
        property_real_id: booking.property_id,
        titolo: `${t('booking.prefix')} ${serviceDetailOpen.titolo}`,
        descrizione: serviceMessage || t('booking.wantToBook'),
        stato: 'aperto',
        creato_da: 'ospite'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      setShowContactForm(false);
      setServiceMessage('');
      toast({ title: t('toast.messageSent') });
    }
  });

  const sendPaymentNotice = useMutation({
      mutationFn: async () => {
          if (!booking || !paymentTicketOpen) return;
          await supabase.from('tickets').insert({
              booking_id: booking.id,
              property_real_id: booking.property_id,
              titolo: `${t('payment.prefix')} ${paymentTicketOpen.tipo}`,
              descrizione: t('payment.tenantWillPay', { date: format(parseISO(payPromise.date), 'dd/MM/yyyy'), method: payPromise.method }),
              stato: 'aperto',
              creato_da: 'ospite',
              related_payment_id: paymentTicketOpen.id,
              promised_payment_date: payPromise.date,
              promised_payment_method: payPromise.method
          });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
          toast({ title: t('toast.adminNotified') });
          setPaymentTicketOpen(null);
          setPayPromise({ date: '', method: '' });
      }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('toast.copied'), duration: 1500 });
  };

  const downloadDoc = async (path: string) => {
    try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
        if (error) throw error;
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
        toast({ title: t('toast.cantOpen'), description: t('toast.fileNotFound'), variant: "destructive" });
    }
  };

  const generateVoucher = (svc: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const today = new Date().toLocaleDateString('it-IT');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('voucher.title')}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;padding:40px;background:#f8fafc}
    .voucher{max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);border:2px solid #e2e8f0}
    .header{background:linear-gradient(135deg,#0f172a,#334155);color:white;padding:32px;text-align:center}
    .header h1{font-size:28px;letter-spacing:4px;margin-bottom:8px}
    .header p{opacity:.7;font-size:13px}
    .image{width:100%;height:200px;object-fit:cover}
    .body{padding:32px}
    .service-name{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .service-desc{color:#64748b;font-size:14px;line-height:1.6;margin-bottom:20px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    .info-box{background:#f8fafc;border-radius:10px;padding:14px}
    .info-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700;margin-bottom:4px}
    .info-value{font-size:15px;font-weight:600;color:#0f172a}
    .price-box{background:linear-gradient(135deg,#dbeafe,#eff6ff);border-radius:10px;padding:14px;text-align:center}
    .price{font-size:28px;font-weight:800;color:#2563eb}
    .divider{border:none;border-top:2px dashed #e2e8f0;margin:24px 0}
    .footer{text-align:center;padding:0 32px 32px}
    .footer p{color:#94a3b8;font-size:12px;font-style:italic}
    @media print{body{padding:0;background:white}.voucher{box-shadow:none;border:1px solid #ccc}}
    </style></head><body>
    <div class="voucher">
    <div class="header"><h1>${t('voucher.title')}</h1><p>${booking.properties_real?.nome || ''}</p></div>
    ${svc.immagine_url ? `<img class="image" src="${svc.immagine_url}" />` : ''}
    <div class="body">
    <div class="service-name">${svc.titolo}</div>
    <div class="service-desc">${svc.descrizione || ''}</div>
    <div class="info-grid">
    <div class="info-box"><div class="info-label">${t('voucher.guest')}</div><div class="info-value">${booking.nome_ospite}</div></div>
    <div class="info-box"><div class="info-label">${t('voucher.dates')}</div><div class="info-value">${booking.data_inizio} → ${booking.data_fine}</div></div>
    ${svc.indirizzo ? `<div class="info-box"><div class="info-label">${t('voucher.location')}</div><div class="info-value">${svc.indirizzo}</div></div>` : ''}
    <div class="price-box"><div class="info-label">${t('voucher.price')}</div><div class="price">€${svc.prezzo}</div></div>
    </div>
    <hr class="divider">
    </div>
    <div class="footer"><p>${t('voucher.present')}</p><p style="margin-top:8px;color:#cbd5e1">${t('voucher.issued')} ${today}</p></div>
    </div>
    <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  if (isLoading || !booking) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">

      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/prop-manager-logo.svg" alt="Logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
             <LanguagePicker />
             <div className="text-right">
                <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{booking.properties_real?.nome}</p>
                <p className="text-xs text-slate-500">{t('portal.guest')}</p>
             </div>
          </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">

        {/* TIMELINE */}
        <div className="flex justify-between items-center px-4 py-2 bg-white rounded-full border shadow-sm mx-2">
            {[{ s: 1, l: t('steps.contacts') }, { s: 2, l: t('steps.documents') }, { s: 3, l: t('steps.verification') }, { s: 4, l: t('steps.access') }].map((step) => (
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
                    {isCheckinUnlocked ? <span className="text-green-700">{t('checkin.active')}</span> : isPendingApproval ? <span className="text-yellow-700">{t('checkin.pending')}</span> : <span className="text-red-700">{t('checkin.online')}</span>}
                    {isCheckinUnlocked ? <Unlock className="text-green-600 w-6 h-6"/> : isPendingApproval ? <Clock className="text-yellow-600 w-6 h-6"/> : <Lock className="text-red-500 w-6 h-6"/>}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

                {currentStep === 1 && (
                    <div className="space-y-4 animate-in fade-in">
                        <p className="text-sm text-slate-600 text-center">{t('contact.prompt')}</p>
                        <div className="space-y-3">
                            <div>
                              <Label className="text-xs uppercase text-slate-500">{t('label.email')}</Label>
                              <Input placeholder={t('placeholder.email')} value={contactForm.email} onChange={e => handleGuestEmailChange(e.target.value)} className={emailError ? 'border-red-400' : ''} />
                              {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                              {emailSuggestion && (
                                <button type="button" className="text-xs text-blue-600 mt-1 underline" onClick={() => handleGuestEmailChange(emailSuggestion)}>
                                  Forse intendevi: {emailSuggestion}?
                                </button>
                              )}
                            </div>
                            <div><Label className="text-xs uppercase text-slate-500">{t('label.phone')}</Label><Input placeholder={t('placeholder.phone')} value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} /></div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact || !!emailError}>{isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : t('button.next')}</Button>
                    </div>
                )}

                {(currentStep === 2 || currentStep === 3) && (
                    <div className="space-y-4 animate-in fade-in">
                          <div className="text-center mb-4">
                            {isPendingApproval ? (
                                <><ShieldCheck className="w-12 h-12 text-yellow-600 mx-auto mb-2"/><h3 className="font-bold text-yellow-900">{t('docs.received')}</h3><p className="text-sm text-yellow-700">{t('docs.hostChecking')}</p></>
                            ) : (
                                <><UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-2"/><h3 className="font-bold text-slate-900">{t('docs.upload')}</h3><p className="text-sm text-slate-500">{t('docs.uploadPrompt')}</p></>
                            )}
                          </div>
                          {!isPendingApproval && (
                            <div className="space-y-3">
                             <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                                <Input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                                {isUploading ? <Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-600"/> : <p className="text-blue-600 font-bold">{t('docs.takePhoto')}</p>}
                             </div>
                             <OcrDocumentUpload compact onExtracted={(data) => {
                               if (data.codice_fiscale) {
                                 supabase.from('bookings').update({ codice_fiscale_ospite: data.codice_fiscale }).eq('id', id);
                               }
                             }} />
                            </div>
                          )}
                          <div className="space-y-2">
                             {documents?.filter((d:any) => d.status === 'in_revisione').map((doc: any) => (
                                 <div key={doc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                     <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</span></div>
                                     <Badge variant="secondary">{t('docs.inReview')}</Badge>
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
                                <p className="text-[10px] uppercase font-bold text-slate-400">{t('label.keyboxCode')}</p>
                                <p className="text-2xl font-mono font-bold tracking-widest">{booking.properties_real?.keybox_code || '---'}</p>
                             </div>
                             <div className="p-4 bg-blue-50 rounded-xl cursor-pointer" onClick={() => copyToClipboard(booking.properties_real?.wifi_password || "")}>
                                <Wifi className="w-6 h-6 mx-auto mb-2 text-blue-500"/>
                                <p className="text-[10px] uppercase font-bold text-blue-400">{t('label.wifi')}</p>
                                <p className="text-lg font-bold text-blue-700 flex items-center justify-center gap-2">
                                    {booking.properties_real?.wifi_ssid ? t('button.copy') : 'N/A'} <Copy className="w-3 h-3"/>
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
                                <MapPin className="w-4 h-4 mr-2 text-blue-600"/> {t('button.navigate')}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* TABS */}
        {(isCheckinUnlocked || payments?.length > 0 || myTickets?.length > 0) && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="experiences" className="text-xs">{t('tab.experiences')}</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs">{t('tab.extra')}</TabsTrigger>
                    <TabsTrigger value="docs" className="text-xs">{t('tab.documents')}</TabsTrigger>
                    <TabsTrigger value="support" className="text-xs">{t('tab.help')}</TabsTrigger>
                </TabsList>

                <TabsContent value="experiences" className="space-y-4">
                    <div className="grid gap-3">
                        {services?.map((svc: any) => (
                            <Card key={svc.id} className="overflow-hidden border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setServiceDetailOpen(svc); setShowContactForm(false); setServiceMessage(''); }}>
                                <div className="flex">
                                    <div className="w-28 h-28 shrink-0 bg-cover bg-center rounded-l-lg" style={{ backgroundImage: `url(${svc.immagine_url || '/placeholder.svg'})` }} />
                                    <CardContent className="p-3 flex flex-col justify-between flex-1 min-w-0">
                                        <div>
                                            <h3 className="font-bold text-sm truncate"><T text={svc.titolo} /></h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-1"><T text={svc.descrizione} /></p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="font-bold text-blue-600">€{svc.prezzo}</span>
                                            <Button size="sm" variant="outline" className="h-7 text-xs">{t('button.details')}</Button>
                                        </div>
                                    </CardContent>
                                </div>
                            </Card>
                        ))}
                        {services?.length === 0 && <p className="text-center text-gray-400 py-8">{t('empty.experiences')}</p>}
                    </div>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>{t('payments.extraExpenses')}</CardTitle><CardDescription>{t('payments.extraDesc')}</CardDescription></CardHeader>
                        <CardContent className="space-y-3">
                            {/* Riepilogo */}
                            {payments && payments.length > 0 && (
                                <div className="bg-slate-50 rounded-lg p-3 border">
                                    <div className="flex justify-between text-sm">
                                        <span>{t('payments.total') || 'Totale'}: <strong>EUR {payments.reduce((acc, p: any) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                                        <span className="text-green-600">{t('badge.paid')}: <strong>EUR {payments.filter((p: any) => ['pagato', 'pre_autorizzato', 'rilasciato'].includes(p.stato)).reduce((acc, p: any) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                                    </div>
                                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${payments.length > 0 ? Math.round(payments.filter((p: any) => ['pagato', 'pre_autorizzato', 'rilasciato'].includes(p.stato)).reduce((acc, p: any) => acc + Number(p.importo), 0) / payments.reduce((acc, p: any) => acc + Number(p.importo), 0) * 100) : 0}%` }} />
                                    </div>
                                </div>
                            )}
                            {payments?.map((pay: any) => (
                                <div key={pay.id} className="p-4 border rounded-xl bg-white shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold capitalize text-sm"><T text={(pay.payment_type || pay.tipo || 'Rata').replace('_', ' ')} /></p>
                                            <p className="text-xs text-gray-500">{t('payment.dueDate') || 'Scad'}: {format(parseISO(pay.data_scadenza), 'dd MMM yyyy')}</p>
                                            {pay.is_preauth && <p className="text-[10px] text-blue-600 mt-1">{t('payment.preauthNote') || 'Non verra addebitata se non necessario'}</p>}
                                        </div>
                                        <p className="font-bold text-lg">EUR {pay.importo}</p>
                                    </div>
                                    <div>
                                        {pay.stato === 'pagato' ? (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <Badge className="bg-green-100 text-green-800 flex-1 justify-center py-1">{t('badge.paid')}</Badge>
                                                    {pay.receipt_url && (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(pay.receipt_url, '_blank')}>
                                                            <Download className="w-3 h-3 mr-1" /> {t('payment.receipt') || 'Ricevuta'}
                                                        </Button>
                                                    )}
                                                </div>
                                                {pay.is_preauth && pay.preauth_captured_amount && Number(pay.preauth_captured_amount) < Number(pay.importo) && (
                                                    <div className="text-xs rounded-lg overflow-hidden border border-gray-200">
                                                        <div className="flex">
                                                            <div className="flex-1 bg-red-50 p-2.5 border-r border-gray-200">
                                                                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.withheld') || 'Trattenuto'}</p>
                                                                <p className="text-red-700 font-semibold">EUR {Number(pay.preauth_captured_amount).toFixed(2)}</p>
                                                            </div>
                                                            <div className="flex-1 bg-green-50 p-2.5">
                                                                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.refunded') || 'Rimborsato'}</p>
                                                                <p className="text-green-700 font-semibold">EUR {(Number(pay.importo) - Number(pay.preauth_captured_amount)).toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                        {pay.preauth_reason && (
                                                            <div className="bg-gray-50 px-2.5 py-2 border-t border-gray-200">
                                                                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.reasonLabel') || 'Motivazione'}</p>
                                                                <p className="text-gray-700"><T text={pay.preauth_reason} /></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {pay.is_preauth && pay.preauth_captured_amount && Number(pay.preauth_captured_amount) >= Number(pay.importo) && (
                                                    <div className="text-xs rounded-lg overflow-hidden border border-red-200">
                                                        <div className="bg-red-50 p-2.5">
                                                            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.withheldFull') || 'Cauzione trattenuta integralmente'}</p>
                                                            <p className="text-red-700 font-semibold">EUR {Number(pay.importo).toFixed(2)}</p>
                                                        </div>
                                                        {pay.preauth_reason && (
                                                            <div className="bg-gray-50 px-2.5 py-2 border-t border-red-200">
                                                                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.reasonLabel') || 'Motivazione'}</p>
                                                                <p className="text-gray-700"><T text={pay.preauth_reason} /></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : pay.stato === 'pre_autorizzato' ? (
                                            <div className="flex gap-2">
                                                <Badge className="bg-blue-100 text-blue-800 flex-1 justify-center py-1">
                                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                                    {t('badge.preAuthorized') || 'Pre-autorizzato'}
                                                </Badge>
                                            </div>
                                        ) : pay.stato === 'rilasciato' ? (
                                            <div className="w-full text-xs rounded-lg overflow-hidden border border-green-200 bg-green-50 p-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5 text-green-700 font-medium">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    {t('payment.depositReleased') || 'Cauzione rilasciata - nessun addebito'}
                                                </div>
                                                {pay.preauth_reason && (
                                                    <p className="text-gray-500 mt-1"><T text={pay.preauth_reason} /></p>
                                                )}
                                            </div>
                                        ) : pay.stato === 'da_pagare' ? (
                                            <Button
                                                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                                                disabled={loadingPaymentId === pay.id}
                                                onClick={() => handlePayNow(pay.id)}
                                            >
                                                {loadingPaymentId === pay.id ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <CreditCard className="w-4 h-4 mr-2" />
                                                )}
                                                {pay.is_preauth ? (t('payment.authorize') || 'Autorizza') : (t('payment.payNow') || 'Paga Ora')}
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="outline" className="w-full h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => setPaymentTicketOpen(pay)}>
                                                {t('button.notify')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {payments?.length === 0 && <p className="text-center text-gray-400 py-4">{t('empty.extra')}</p>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4">
                      <Card>
                        <CardHeader><CardTitle>{t('docs.shared')}</CardTitle><CardDescription>{t('docs.sharedDesc')}</CardDescription></CardHeader>
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
                             {documents?.length === 0 && <p className="text-center text-gray-400 py-4">{t('empty.docs')}</p>}
                        </CardContent>
                      </Card>
                </TabsContent>

                <TabsContent value="support" className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>{t('support.chatHost')}</CardTitle><CardDescription>{t('support.needHelp')}</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <Input placeholder={t('placeholder.subject')} value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                            <Textarea placeholder={t('placeholder.writeHere')} value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} />
                            <Button className="w-full" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}><Send className="w-4 h-4 mr-2" /> {t('button.sendMessage')}</Button>
                        </CardContent>
                    </Card>
                    <div className="space-y-3">
                        {myTickets?.map((tk: any) => (
                            <div key={tk.id} className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-2"><p className="font-medium"><T text={tk.titolo} /></p><Badge variant={tk.stato === 'risolto' ? 'default' : 'secondary'}>{tk.stato}</Badge></div>
                                <p className="text-sm text-gray-600 mb-2">"<T text={tk.descrizione} />"</p>
                                {tk.admin_notes && <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md"><p className="text-xs font-bold text-blue-700 mb-1 flex items-center"><UserCog className="w-3 h-3 mr-1" /> {t('label.hostReply')}</p><p className="text-sm text-blue-900"><T text={tk.admin_notes} /></p></div>}
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        )}

        {/* DIALOG PAGAMENTO */}
        <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="max-w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>{t('dialog.notifyPayment')}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">{t('dialog.paymentDesc')} <strong>€{paymentTicketOpen?.importo}</strong> per <T text={paymentTicketOpen?.tipo} />.</p>
                    <div className="space-y-2"><Label>{t('label.expectedDate')}</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-2"><Label>{t('label.method')}</Label><Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}><SelectTrigger><SelectValue placeholder={t('placeholder.select')}/></SelectTrigger><SelectContent><SelectItem value="bonifico">{t('method.transfer')}</SelectItem><SelectItem value="contanti">{t('method.cash')}</SelectItem><SelectItem value="altro">{t('method.other')}</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full">{t('button.sendNotice')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* DIALOG DETTAGLIO SERVIZIO */}
        <Dialog open={!!serviceDetailOpen} onOpenChange={() => { setServiceDetailOpen(null); setShowContactForm(false); setServiceMessage(''); }}>
            <DialogContent className="max-w-[95vw] sm:max-w-md p-0 rounded-xl overflow-hidden">
                {serviceDetailOpen?.immagine_url && (
                    <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${serviceDetailOpen.immagine_url})` }} />
                )}
                <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                        <h2 className="font-bold text-xl text-slate-900"><T text={serviceDetailOpen?.titolo} /></h2>
                        <span className="font-bold text-xl text-blue-600 shrink-0 ml-3">€{serviceDetailOpen?.prezzo}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed"><T text={serviceDetailOpen?.descrizione} /></p>

                    {serviceDetailOpen?.indirizzo && (
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 flex-1">{serviceDetailOpen.indirizzo}</span>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 shrink-0" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(serviceDetailOpen.indirizzo)}`, '_blank')}>
                                <MapPin className="w-3 h-3 mr-1" />{t('button.navigate')}
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        {serviceDetailOpen?.link_prenotazione && (
                            <Button variant="outline" className="w-full" onClick={() => window.open(serviceDetailOpen.link_prenotazione, '_blank')}>
                                <ExternalLink className="w-4 h-4 mr-2" />{t('button.viewOffer')}
                            </Button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => generateVoucher(serviceDetailOpen)}>
                                <Ticket className="w-4 h-4 mr-2" />{t('button.downloadVoucher')}
                            </Button>
                            <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => { setShowContactForm(!showContactForm); if (!serviceMessage) setServiceMessage(t('booking.wantToBook')); }}>
                                <MessageCircle className="w-4 h-4 mr-2" />{t('button.contactStructure')}
                            </Button>
                        </div>
                    </div>

                    {showContactForm && (
                        <div className="space-y-3 pt-2 border-t">
                            <Textarea placeholder={t('placeholder.yourMessage')} value={serviceMessage} onChange={e => setServiceMessage(e.target.value)} rows={3} />
                            <Button onClick={() => sendServiceContact.mutate()} disabled={!serviceMessage} className="w-full">
                                <Send className="w-4 h-4 mr-2" />{t('button.sendMessage')}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
