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
  CheckCircle, FileText, Clock, ShieldCheck, UploadCloud, Send, UserCog, Download, Key, ExternalLink, Ticket, MessageCircle, CreditCard, Receipt,
  Home, Phone, AlertTriangle, ChevronDown, ChevronUp, BookOpen, Navigation
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
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

/* ───────────── FAQ Accordion Item ───────────── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors" onClick={() => setOpen(!open)}>
        {question}
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && <div className="px-3 pb-3 text-sm text-slate-600 border-t bg-slate-50">{answer}</div>}
    </div>
  );
}

function GuestPortalInner() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('infoHouse');
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
  const [expFilter, setExpFilter] = useState('all');

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
  const prop = booking?.properties_real;

  // Experience categories extraction
  const categories = React.useMemo(() => {
    if (!services || services.length === 0) return [];
    const cats = new Set<string>();
    services.forEach((s: any) => { if (s.categoria) cats.add(s.categoria); });
    return Array.from(cats);
  }, [services]);

  const filteredServices = React.useMemo(() => {
    if (!services) return [];
    if (expFilter === 'all') return services;
    return services.filter((s: any) => s.categoria === expFilter);
  }, [services, expFilter]);

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
      const { data: inserted, error } = await supabase.from('tickets').insert({
        booking_id: booking.id, property_real_id: booking.property_id, titolo: ticketForm.titolo, descrizione: ticketForm.descrizione, stato: 'aperto', creato_da: 'ospite'
      }).select('id').single();
      if (error) throw error;

      if (inserted?.id) {
        supabase.functions.invoke('analyze-ticket', {
          body: {
            ticket_id: inserted.id,
            titolo: ticketForm.titolo,
            descrizione: ticketForm.descrizione,
            property_name: booking.properties_real?.nome || '',
            guest_name: booking.nome_ospite || '',
            source: 'guest',
          }
        }).catch(err => console.error('AI analysis error:', err));
      }
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
      const ticketTitle = `${t('booking.prefix')} ${serviceDetailOpen.titolo}`;
      const ticketDesc = serviceMessage || t('booking.wantToBook');
      const { data: inserted, error } = await supabase.from('tickets').insert({
        booking_id: booking.id,
        property_real_id: booking.property_id,
        titolo: ticketTitle,
        descrizione: ticketDesc,
        stato: 'aperto',
        creato_da: 'ospite'
      }).select('id').single();
      if (error) throw error;

      if (inserted?.id) {
        supabase.functions.invoke('analyze-ticket', {
          body: {
            ticket_id: inserted.id,
            titolo: ticketTitle,
            descrizione: ticketDesc,
            property_name: booking.properties_real?.nome || '',
            guest_name: booking.nome_ospite || '',
            source: 'guest',
          }
        }).catch(err => console.error('AI analysis error:', err));
      }
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
          const ticketTitle = `${t('payment.prefix')} ${paymentTicketOpen.tipo}`;
          const ticketDesc = t('payment.tenantWillPay', { date: format(parseISO(payPromise.date), 'dd/MM/yyyy'), method: payPromise.method });
          const { data: inserted, error } = await supabase.from('tickets').insert({
              booking_id: booking.id,
              property_real_id: booking.property_id,
              titolo: ticketTitle,
              descrizione: ticketDesc,
              stato: 'aperto',
              creato_da: 'ospite',
              related_payment_id: paymentTicketOpen.id,
              promised_payment_date: payPromise.date,
              promised_payment_method: payPromise.method
          }).select('id').single();
          if (error) throw error;

          if (inserted?.id) {
            supabase.functions.invoke('analyze-ticket', {
              body: {
                ticket_id: inserted.id,
                titolo: ticketTitle,
                descrizione: ticketDesc,
                property_name: booking.properties_real?.nome || '',
                guest_name: booking.nome_ospite || '',
                source: 'guest',
              }
            }).catch(err => console.error('AI analysis error:', err));
          }
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

  const mapsUrl = prop?.maps_url || `https://maps.google.com/?q=${encodeURIComponent((prop?.indirizzo || '') + ' ' + (prop?.citta || ''))}`;
  const checkinInstructions = prop?.checkin_instructions || prop?.istruzioni_checkin || null;

  // Contatti host configurati
  const hostContacts = [
    { name: 'Kristian Rinaldi', phone: '+393917924372', display: '391 792 4372' },
    { name: 'Ilaria Ghilardini', phone: '+393488018359', display: '348 801 8359' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">

      {/* ─── HEADER ─── */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/prop-manager-logo.svg" alt="Logo" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
             <LanguagePicker />
          </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-5 mt-0">

        {/* ─── P0: WELCOME BANNER ─── */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* Background: property image or gradient */}
          <div
            className="h-44 bg-cover bg-center"
            style={{
              backgroundImage: prop?.immagine_url
                ? `url(${prop.immagine_url})`
                : 'linear-gradient(135deg, #0f172a 0%, #334155 50%, #475569 100%)'
            }}
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">
              {t('welcome.guest')}{booking.nome_ospite ? `, ${booking.nome_ospite.split(' ')[0]}` : ''}
            </p>
            <h1 className="text-xl font-bold mt-0.5 leading-tight">
              {t('welcome.title')} {prop?.nome || 'la tua casa'}
            </h1>
            {booking.data_inizio && booking.data_fine && (
              <div className="flex items-center gap-2 mt-2 text-xs opacity-90">
                <Clock className="w-3 h-3" />
                <span>{format(parseISO(booking.data_inizio), 'dd MMM', { locale: it })} — {format(parseISO(booking.data_fine), 'dd MMM yyyy', { locale: it })}</span>
              </div>
            )}
            {prop?.indirizzo && (
              <button
                className="flex items-center gap-1.5 mt-2 text-xs opacity-80 hover:opacity-100 transition-opacity"
                onClick={() => window.open(mapsUrl, '_blank')}
              >
                <MapPin className="w-3 h-3" />
                <span className="underline underline-offset-2">{prop.indirizzo}{prop.citta ? `, ${prop.citta}` : ''}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── P1: TIMELINE MIGLIORATA ─── */}
        <div className="bg-white rounded-xl border shadow-sm p-3">
          <div className="flex justify-between items-center px-2">
            {[{ s: 1, l: t('steps.contacts') }, { s: 2, l: t('steps.documents') }, { s: 3, l: t('steps.verification') }, { s: 4, l: t('steps.access') }].map((step, i) => (
                <React.Fragment key={step.s}>
                  <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${currentStep >= step.s ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                          {currentStep > step.s ? <CheckCircle className="w-4 h-4"/> : step.s}
                      </div>
                      <span className={`text-[9px] uppercase font-bold leading-tight text-center max-w-[60px] ${currentStep >= step.s ? 'text-slate-900' : 'text-slate-300'}`}>{step.l}</span>
                  </div>
                  {i < 3 && <div className={`flex-1 h-0.5 mx-1 mt-[-12px] rounded-full ${currentStep > step.s ? 'bg-slate-900' : 'bg-slate-100'}`} />}
                </React.Fragment>
            ))}
          </div>
          {/* Contextual message */}
          {currentStep === 1 && <p className="text-center text-xs text-slate-500 mt-2 px-2">{t('contact.prompt')}</p>}
          {currentStep === 2 && <p className="text-center text-xs text-slate-500 mt-2 px-2">{t('docs.uploadPrompt')}</p>}
          {currentStep === 3 && <p className="text-center text-xs text-yellow-700 mt-2 px-2">{t('checkin.pending')}</p>}
          {currentStep === 4 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <p className="text-xs font-semibold text-green-700">{t('checkin.active')}</p>
            </div>
          )}
        </div>

        {/* ─── SMART CARD (Check-in steps) ─── */}
        <Card className={`border overflow-hidden shadow-md transition-all duration-500 ${isCheckinUnlocked ? 'border-green-300 bg-green-50/30' : isPendingApproval ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200 bg-white'}`}>
            <CardContent className="pt-5 pb-5 space-y-5">

                {currentStep === 1 && (
                    <div className="space-y-4 animate-in fade-in px-1">
                        <div className="space-y-3">
                            <div>
                              <Label className="text-xs uppercase text-slate-500 font-semibold">{t('label.email')}</Label>
                              <Input placeholder={t('placeholder.email')} value={contactForm.email} onChange={e => handleGuestEmailChange(e.target.value)} className={`mt-1 ${emailError ? 'border-red-400' : ''}`} />
                              {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                              {emailSuggestion && (
                                <button type="button" className="text-xs text-blue-600 mt-1 underline" onClick={() => handleGuestEmailChange(emailSuggestion)}>
                                  Forse intendevi: {emailSuggestion}?
                                </button>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs uppercase text-slate-500 font-semibold">{t('label.phone')}</Label>
                              <Input placeholder={t('placeholder.phone')} value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className="mt-1" />
                            </div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800 h-11" onClick={saveContactInfo} disabled={isSavingContact || !!emailError}>
                          {isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : t('button.next')}
                        </Button>
                    </div>
                )}

                {(currentStep === 2 || currentStep === 3) && (
                    <div className="space-y-4 animate-in fade-in">
                          <div className="text-center mb-2">
                            {isPendingApproval ? (
                                <><ShieldCheck className="w-10 h-10 text-yellow-600 mx-auto mb-2"/><h3 className="font-bold text-yellow-900 text-sm">{t('docs.received')}</h3><p className="text-xs text-yellow-700">{t('docs.hostChecking')}</p></>
                            ) : (
                                <><UploadCloud className="w-10 h-10 text-slate-300 mx-auto mb-2"/><h3 className="font-bold text-slate-900 text-sm">{t('docs.upload')}</h3><p className="text-xs text-slate-500">{t('docs.uploadPrompt')}</p></>
                            )}
                          </div>
                          {!isPendingApproval && (
                            <div className="space-y-3">
                             <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:bg-slate-50 transition-colors relative">
                                <Input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                                {isUploading ? <Loader2 className="animate-spin w-5 h-5 mx-auto text-blue-600"/> : <p className="text-blue-600 font-bold text-sm">{t('docs.takePhoto')}</p>}
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
                                 <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white border rounded-lg shadow-sm">
                                     <div className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 text-blue-500 shrink-0" /><span className="text-xs font-medium truncate">{doc.filename}</span></div>
                                     <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">{t('docs.inReview')}</Badge>
                                 </div>
                             ))}
                          </div>
                    </div>
                )}

                {isCheckinUnlocked && (
                    <div className="space-y-4 animate-in fade-in">
                        {/* Keybox + WiFi prominent cards */}
                        <div className="grid grid-cols-2 gap-3 text-center">
                             <div className="p-3 bg-slate-900 text-white rounded-xl">
                                <Key className="w-5 h-5 mx-auto mb-1.5 text-yellow-400"/>
                                <p className="text-[9px] uppercase font-bold text-slate-400">{t('info.keyboxCode')}</p>
                                <p className="text-xl font-mono font-bold tracking-widest mt-0.5">{prop?.keybox_code || prop?.codice_keybox || '---'}</p>
                             </div>
                             <div className="p-3 bg-blue-50 rounded-xl cursor-pointer" onClick={() => copyToClipboard(prop?.wifi_password || "")}>
                                <Wifi className="w-5 h-5 mx-auto mb-1.5 text-blue-500"/>
                                <p className="text-[9px] uppercase font-bold text-blue-400">{t('info.wifi')}</p>
                                <p className="text-xs font-semibold text-blue-700 mt-0.5">{prop?.wifi_ssid || 'N/A'}</p>
                                {prop?.wifi_password && (
                                  <p className="text-blue-600 text-[10px] flex items-center justify-center gap-1 mt-1">
                                    <Copy className="w-2.5 h-2.5"/> {t('button.copy')}
                                  </p>
                                )}
                             </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* ─── TABS (visible only after step 1) ─── */}
        {hasContactInfo && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-4 h-auto p-1">
                    {isCheckinUnlocked && (
                      <TabsTrigger value="infoHouse" className="text-[11px] py-2 px-1 leading-tight">
                        <Home className="w-3.5 h-3.5 mr-1" />{t('tab.infoHouse')}
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="experiences" className="text-[11px] py-2 px-1 leading-tight">
                      {t('tab.experiences')}
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="text-[11px] py-2 px-1 leading-tight">
                      {t('tab.payments')}
                    </TabsTrigger>
                    <TabsTrigger value="support" className="text-[11px] py-2 px-1 leading-tight">
                      {t('tab.help')}
                    </TabsTrigger>
                    {!isCheckinUnlocked && (
                      <TabsTrigger value="docs" className="text-[11px] py-2 px-1 leading-tight">
                        {t('tab.documents')}
                      </TabsTrigger>
                    )}
                </TabsList>

                {/* ─── P0: TAB INFO CASA ─── */}
                {isCheckinUnlocked && (
                <TabsContent value="infoHouse" className="space-y-3 mt-3">
                    {/* Navigate button */}
                    <Button variant="outline" className="w-full h-12 justify-start gap-3 text-sm" onClick={() => window.open(mapsUrl, '_blank')}>
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                          <Navigation className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="font-semibold text-slate-900 text-xs">{t('info.howToArrive')}</p>
                          <p className="text-[10px] text-slate-500 truncate">{prop?.indirizzo}{prop?.citta ? `, ${prop.citta}` : ''}</p>
                        </div>
                    </Button>

                    {/* Check-in video */}
                    {prop?.checkin_video_url && (
                      <Button variant="outline" className="w-full h-12 justify-start gap-3 text-sm" onClick={() => window.open(prop.checkin_video_url, '_blank')}>
                          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                            <Youtube className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-slate-900 text-xs">{t('info.checkinVideo')}</p>
                            <p className="text-[10px] text-slate-500">{t('info.watchVideo')}</p>
                          </div>
                      </Button>
                    )}

                    {/* Check-in instructions */}
                    {checkinInstructions && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-500"/> {t('info.checkinInstructions')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{checkinInstructions}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* House rules */}
                    {prop?.house_rules && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-slate-500"/> {t('info.houseRules')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{prop.house_rules}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Emergency & host contacts */}
                    <Card className="border shadow-sm">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-green-500"/> {t('info.emergency')}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        {hostContacts.map((contact) => (
                          <a key={contact.phone} href={`tel:${contact.phone}`} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                            <Phone className="w-4 h-4 text-green-600" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800">{contact.name}</p>
                              <p className="text-[10px] text-slate-500">{contact.display}</p>
                            </div>
                          </a>
                        ))}
                        <a href="tel:112" className="flex items-center gap-3 p-2.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <p className="text-xs font-semibold text-red-800">{t('info.emergencyNumber')}</p>
                        </a>
                      </CardContent>
                    </Card>

                    {/* Documents (moved from separate tab) */}
                    {documents && documents.filter((d:any) => d.status !== 'in_revisione').length > 0 && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm">{t('docs.shared')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                          {documents.filter((d:any) => d.status !== 'in_revisione').map((doc: any) => (
                            <div key={doc.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-blue-500 shrink-0"/>
                                <span className="text-xs truncate">{doc.filename}</span>
                              </div>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadDoc(doc.file_url)}>
                                <Download className="w-3.5 h-3.5"/>
                              </Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                </TabsContent>
                )}

                {/* ─── TAB ESPERIENZE (P1: categorie + card migliorate) ─── */}
                <TabsContent value="experiences" className="space-y-3 mt-3">
                    {/* Category chips */}
                    {categories.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                        <button
                          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${expFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          onClick={() => setExpFilter('all')}
                        >
                          {t('experiences.allCategories')}
                        </button>
                        {categories.map(cat => (
                          <button
                            key={cat}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${expFilter === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            onClick={() => setExpFilter(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid gap-3">
                        {filteredServices?.map((svc: any) => (
                            <Card key={svc.id} className="overflow-hidden border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setServiceDetailOpen(svc); setShowContactForm(false); setServiceMessage(''); }}>
                                <div className="flex">
                                    <div className="w-24 h-24 shrink-0 bg-cover bg-center rounded-l-lg" style={{ backgroundImage: `url(${svc.immagine_url || '/placeholder.svg'})` }} />
                                    <CardContent className="p-3 flex flex-col justify-between flex-1 min-w-0">
                                        <div>
                                            <h3 className="font-bold text-sm truncate leading-tight"><T text={svc.titolo} /></h3>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug"><T text={svc.descrizione} /></p>
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            {Number(svc.prezzo) === 0 ? (
                                              <Badge className="bg-green-100 text-green-700 text-[10px] font-bold border-0">{t('experiences.free')}</Badge>
                                            ) : (
                                              <span className="font-bold text-blue-600 text-sm">€{svc.prezzo}</span>
                                            )}
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">{t('button.details')}</Button>
                                        </div>
                                    </CardContent>
                                </div>
                            </Card>
                        ))}
                        {filteredServices?.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">{t('empty.experiences')}</p>}
                    </div>
                </TabsContent>

                {/* ─── TAB PAGAMENTI (P1: UX migliorata) ─── */}
                <TabsContent value="payments" className="space-y-3 mt-3">
                    {/* Summary bar */}
                    {payments && payments.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600">{t('payments.total') || 'Totale'}: <strong>€{payments.reduce((acc: number, p: any) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                                <span className="text-green-600">{t('badge.paid')}: <strong>€{payments.filter((p: any) => ['pagato', 'pre_autorizzato', 'rilasciato'].includes(p.stato)).reduce((acc: number, p: any) => acc + Number(p.importo), 0).toFixed(2)}</strong></span>
                            </div>
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${payments.length > 0 ? Math.round(payments.filter((p: any) => ['pagato', 'pre_autorizzato', 'rilasciato'].includes(p.stato)).reduce((acc: number, p: any) => acc + Number(p.importo), 0) / payments.reduce((acc: number, p: any) => acc + Number(p.importo), 0) * 100) : 0}%` }} />
                            </div>
                        </div>
                    )}

                    {payments?.map((pay: any) => {
                      const payType = (pay.payment_type || pay.tipo || '').toLowerCase();
                      const isDeposit = payType.includes('cauzione') || payType.includes('deposit') || pay.is_preauth;
                      const isTax = payType.includes('tassa') || payType.includes('soggiorno') || payType.includes('tax');

                      return (
                        <div key={pay.id} className="p-3.5 border rounded-xl bg-white shadow-sm space-y-2.5">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDeposit ? 'bg-purple-50' : isTax ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                      {isDeposit ? <ShieldCheck className="w-4 h-4 text-purple-600" /> : isTax ? <Receipt className="w-4 h-4 text-amber-600" /> : <CreditCard className="w-4 h-4 text-slate-500" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold capitalize text-sm leading-tight"><T text={(pay.payment_type || pay.tipo || 'Rata').replace('_', ' ')} /></p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{t('payment.dueDate') || 'Scad'}: {format(parseISO(pay.data_scadenza), 'dd MMM yyyy')}</p>
                                        {isDeposit && <p className="text-[10px] text-purple-600 mt-0.5">{t('payments.depositExplain')}</p>}
                                        {isTax && <p className="text-[10px] text-amber-600 mt-0.5">{t('payments.taxExplain')}</p>}
                                        {pay.is_preauth && !isDeposit && <p className="text-[10px] text-blue-600 mt-0.5">{t('payment.preauthNote')}</p>}
                                    </div>
                                </div>
                                <p className="font-bold text-base shrink-0">€{pay.importo}</p>
                            </div>
                            <div>
                                {pay.stato === 'pagato' ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Badge className="bg-green-100 text-green-800 flex-1 justify-center py-1 text-[11px]">{t('badge.paid')}</Badge>
                                            {pay.receipt_url && (
                                                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => window.open(pay.receipt_url, '_blank')}>
                                                    <Download className="w-3 h-3 mr-1" /> {t('payment.receipt') || 'Ricevuta'}
                                                </Button>
                                            )}
                                        </div>
                                        {pay.is_preauth && pay.preauth_captured_amount && Number(pay.preauth_captured_amount) < Number(pay.importo) && (
                                            <div className="text-xs rounded-lg overflow-hidden border border-gray-200">
                                                <div className="flex">
                                                    <div className="flex-1 bg-red-50 p-2 border-r border-gray-200">
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.withheld')}</p>
                                                        <p className="text-red-700 font-semibold">€{Number(pay.preauth_captured_amount).toFixed(2)}</p>
                                                    </div>
                                                    <div className="flex-1 bg-green-50 p-2">
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.refunded')}</p>
                                                        <p className="text-green-700 font-semibold">€{(Number(pay.importo) - Number(pay.preauth_captured_amount)).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                {pay.preauth_reason && (
                                                    <div className="bg-gray-50 px-2 py-1.5 border-t border-gray-200">
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.reasonLabel')}</p>
                                                        <p className="text-gray-700 text-xs"><T text={pay.preauth_reason} /></p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {pay.is_preauth && pay.preauth_captured_amount && Number(pay.preauth_captured_amount) >= Number(pay.importo) && (
                                            <div className="text-xs rounded-lg overflow-hidden border border-red-200">
                                                <div className="bg-red-50 p-2">
                                                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.withheldFull')}</p>
                                                    <p className="text-red-700 font-semibold">€{Number(pay.importo).toFixed(2)}</p>
                                                </div>
                                                {pay.preauth_reason && (
                                                    <div className="bg-gray-50 px-2 py-1.5 border-t border-red-200">
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{t('payment.reasonLabel')}</p>
                                                        <p className="text-gray-700 text-xs"><T text={pay.preauth_reason} /></p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : pay.stato === 'pre_autorizzato' ? (
                                    <Badge className="bg-blue-100 text-blue-800 w-full justify-center py-1 text-[11px]">
                                        <ShieldCheck className="w-3 h-3 mr-1" />
                                        {t('badge.preAuthorized') || 'Pre-autorizzato'}
                                    </Badge>
                                ) : pay.stato === 'rilasciato' ? (
                                    <div className="w-full text-xs rounded-lg overflow-hidden border border-green-200 bg-green-50 p-2 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-green-700 font-medium">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            {t('payment.depositReleased')}
                                        </div>
                                        {pay.preauth_reason && (
                                            <p className="text-gray-500 mt-1"><T text={pay.preauth_reason} /></p>
                                        )}
                                    </div>
                                ) : pay.stato === 'da_pagare' ? (
                                    <Button
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white h-10"
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
                      );
                    })}
                    {payments?.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">{t('empty.extra')}</p>}
                </TabsContent>

                {/* ─── TAB DOCUMENTI (only pre-checkin) ─── */}
                {!isCheckinUnlocked && (
                <TabsContent value="docs" className="space-y-3 mt-3">
                      <Card>
                        <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">{t('docs.shared')}</CardTitle><CardDescription className="text-xs">{t('docs.sharedDesc')}</CardDescription></CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                             {documents?.filter((d:any) => d.status !== 'in_revisione').map((doc: any) => (
                                 <div key={doc.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded border">
                                     <div className="flex items-center gap-2 min-w-0">
                                         <FileText className="w-4 h-4 text-blue-500 shrink-0"/>
                                         <span className="text-xs truncate">{doc.filename}</span>
                                     </div>
                                     <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadDoc(doc.file_url)}>
                                         <Download className="w-3.5 h-3.5"/>
                                     </Button>
                                 </div>
                             ))}
                             {documents?.length === 0 && <p className="text-center text-gray-400 py-4 text-xs">{t('empty.docs')}</p>}
                        </CardContent>
                      </Card>
                </TabsContent>
                )}

                {/* ─── TAB HELP (P1: FAQ + WhatsApp + numeri utili) ─── */}
                <TabsContent value="support" className="space-y-4 mt-3">
                    {/* WhatsApp quick action — Kristian */}
                    <a
                      href="https://wa.me/393917924372"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-green-900">{t('faq.whatsappHost')}</p>
                        <p className="text-[10px] text-green-700">Kristian Rinaldi — 391 792 4372</p>
                      </div>
                    </a>

                    {/* FAQ Accordion */}
                    <Card className="border shadow-sm">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm">{t('faq.title')}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        <FaqItem question={t('faq.checkinTime')} answer={t('faq.checkinTimeAnswer')} />
                        <FaqItem question={t('faq.parking')} answer={t('faq.parkingAnswer')} />
                        <FaqItem question={t('faq.emergencyQuestion')} answer={t('faq.emergencyAnswer')} />
                      </CardContent>
                    </Card>

                    {/* Useful numbers */}
                    <Card className="border shadow-sm">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm">{t('faq.usefulNumbers')}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-1.5">
                        {hostContacts.map((contact) => (
                          <a key={contact.phone} href={`tel:${contact.phone}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-xs font-medium">{contact.name}</span>
                            </div>
                            <span className="text-xs text-slate-500">{contact.display}</span>
                          </a>
                        ))}
                        <a href="tel:112" className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-xs font-medium">{t('faq.emergencies')}</span>
                          </div>
                          <span className="text-xs text-slate-500">112</span>
                        </a>
                      </CardContent>
                    </Card>

                    {/* Ticket form (fallback) */}
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm">{t('faq.writeTicket')}</CardTitle>
                          <CardDescription className="text-xs">{t('support.needHelp')}</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-3">
                            <Input placeholder={t('placeholder.subject')} value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} className="text-sm" />
                            <Textarea placeholder={t('placeholder.writeHere')} value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} className="text-sm" rows={3} />
                            <Button className="w-full h-9 text-sm" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}><Send className="w-3.5 h-3.5 mr-2" /> {t('button.sendMessage')}</Button>
                        </CardContent>
                    </Card>

                    {/* Existing tickets */}
                    {myTickets && myTickets.length > 0 && (
                      <div className="space-y-2">
                        {myTickets.map((tk: any) => (
                            <div key={tk.id} className="bg-white p-3 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-1.5">
                                  <p className="font-medium text-sm truncate mr-2"><T text={tk.titolo} /></p>
                                  <Badge variant={tk.stato === 'risolto' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{tk.stato}</Badge>
                                </div>
                                <p className="text-xs text-gray-600 mb-1.5 line-clamp-2"><T text={tk.descrizione} /></p>
                                {tk.admin_notes && (
                                  <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-md">
                                    <p className="text-[10px] font-bold text-blue-700 mb-0.5 flex items-center"><UserCog className="w-3 h-3 mr-1" /> {t('label.hostReply')}</p>
                                    <p className="text-xs text-blue-900"><T text={tk.admin_notes} /></p>
                                  </div>
                                )}
                            </div>
                        ))}
                      </div>
                    )}
                </TabsContent>
            </Tabs>
        )}

        {/* ─── DIALOG PAGAMENTO ─── */}
        <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="max-w-[92vw] sm:max-w-sm rounded-xl">
                <DialogHeader><DialogTitle className="text-base">{t('dialog.notifyPayment')}</DialogTitle></DialogHeader>
                <div className="space-y-3 py-1">
                    <p className="text-xs text-gray-500">{t('dialog.paymentDesc')} <strong>€{paymentTicketOpen?.importo}</strong> per <T text={paymentTicketOpen?.tipo} />.</p>
                    <div className="space-y-1.5"><Label className="text-xs">{t('label.expectedDate')}</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">{t('label.method')}</Label><Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}><SelectTrigger><SelectValue placeholder={t('placeholder.select')}/></SelectTrigger><SelectContent><SelectItem value="bonifico">{t('method.transfer')}</SelectItem><SelectItem value="contanti">{t('method.cash')}</SelectItem><SelectItem value="altro">{t('method.other')}</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full h-10">{t('button.sendNotice')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ─── DIALOG DETTAGLIO SERVIZIO ─── */}
        <Dialog open={!!serviceDetailOpen} onOpenChange={() => { setServiceDetailOpen(null); setShowContactForm(false); setServiceMessage(''); }}>
            <DialogContent className="max-w-[92vw] sm:max-w-md p-0 rounded-xl overflow-hidden">
                {serviceDetailOpen?.immagine_url && (
                    <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${serviceDetailOpen.immagine_url})` }} />
                )}
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <h2 className="font-bold text-lg text-slate-900 leading-tight"><T text={serviceDetailOpen?.titolo} /></h2>
                        {Number(serviceDetailOpen?.prezzo) === 0 ? (
                          <Badge className="bg-green-100 text-green-700 font-bold border-0 shrink-0 ml-3">{t('experiences.free')}</Badge>
                        ) : (
                          <span className="font-bold text-lg text-blue-600 shrink-0 ml-3">€{serviceDetailOpen?.prezzo}</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed"><T text={serviceDetailOpen?.descrizione} /></p>

                    {serviceDetailOpen?.indirizzo && (
                        <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-700 flex-1">{serviceDetailOpen.indirizzo}</span>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-blue-600 shrink-0" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(serviceDetailOpen.indirizzo)}`, '_blank')}>
                                <MapPin className="w-3 h-3 mr-1" />{t('button.navigate')}
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        {serviceDetailOpen?.link_prenotazione && (
                            <Button variant="outline" className="w-full text-sm" onClick={() => window.open(serviceDetailOpen.link_prenotazione, '_blank')}>
                                <ExternalLink className="w-4 h-4 mr-2" />{t('button.viewOffer')}
                            </Button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="text-xs" onClick={() => generateVoucher(serviceDetailOpen)}>
                                <Ticket className="w-3.5 h-3.5 mr-1.5" />{t('button.downloadVoucher')}
                            </Button>
                            <Button className="bg-slate-900 hover:bg-slate-800 text-xs" onClick={() => { setShowContactForm(!showContactForm); if (!serviceMessage) setServiceMessage(t('booking.wantToBook')); }}>
                                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />{t('button.contactStructure')}
                            </Button>
                        </div>
                    </div>

                    {showContactForm && (
                        <div className="space-y-2 pt-2 border-t">
                            <Textarea placeholder={t('placeholder.yourMessage')} value={serviceMessage} onChange={e => setServiceMessage(e.target.value)} rows={3} className="text-sm" />
                            <Button onClick={() => sendServiceContact.mutate()} disabled={!serviceMessage} className="w-full h-9 text-sm">
                                <Send className="w-3.5 h-3.5 mr-2" />{t('button.sendMessage')}
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
