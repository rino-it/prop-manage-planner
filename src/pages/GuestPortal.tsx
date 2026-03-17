import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
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
  CheckCircle, FileText, Clock, ShieldCheck, UploadCloud, Send, UserCog, Download, Key, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import LanguagePicker from '@/components/LanguagePicker';
import T from '@/components/TranslatedText';

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

  const [activeTab, setActiveTab] = useState('experiences');
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [serviceContactOpen, setServiceContactOpen] = useState<any>(null);
  const [serviceMessage, setServiceMessage] = useState('');

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
      const fileName = `doc_${booking.id}_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upError } = await supabase.storage.from('documents').upload(fileName, file);
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
      if (!booking || !serviceContactOpen) return;
      await supabase.from('tickets').insert({
        booking_id: booking.id,
        property_real_id: booking.property_id,
        titolo: `${t('booking.prefix')} ${serviceContactOpen.titolo}`,
        descrizione: serviceMessage || t('booking.wantToBook'),
        stato: 'aperto',
        creato_da: 'ospite'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      toast({ title: t('toast.messageSent') });
      setServiceContactOpen(null);
      setServiceMessage('');
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
                            <div><Label className="text-xs uppercase text-slate-500">{t('label.email')}</Label><Input placeholder={t('placeholder.email')} value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
                            <div><Label className="text-xs uppercase text-slate-500">{t('label.phone')}</Label><Input placeholder={t('placeholder.phone')} value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} /></div>
                        </div>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact}>{isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : t('button.next')}</Button>
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
                             <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                                <Input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                                {isUploading ? <Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-600"/> : <p className="text-blue-600 font-bold">{t('docs.takePhoto')}</p>}
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
                <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="experiences" className="text-xs">{t('tab.experiences')}</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs">{t('tab.extra')}</TabsTrigger>
                    <TabsTrigger value="docs" className="text-xs">{t('tab.documents')}</TabsTrigger>
                    <TabsTrigger value="support" className="text-xs">{t('tab.help')}</TabsTrigger>
                </TabsList>

                <TabsContent value="experiences" className="space-y-4">
                    <div className="grid gap-3">
                        {services?.map((svc: any) => (
                            <Card key={svc.id} className="overflow-hidden border-0 shadow-md">
                                <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${svc.immagine_url || '/placeholder.svg'})` }} />
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg"><T text={svc.titolo} /></h3>
                                        <Badge className="bg-green-100 text-green-800">{t('badge.recommended')}</Badge>
                                    </div>
                                    <p className="text-sm text-slate-600 line-clamp-2"><T text={svc.descrizione} /></p>
                                    {svc.indirizzo && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                            <MapPin className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{svc.indirizzo}</span>
                                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-blue-600" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(svc.indirizzo)}`, '_blank')}>{t('button.navigate')}</Button>
                                        </div>
                                    )}
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="font-bold text-blue-600">€{svc.prezzo}</span>
                                        <div className="flex gap-2">
                                            {svc.link_prenotazione && (
                                                <Button size="sm" variant="outline" onClick={() => window.open(svc.link_prenotazione, '_blank')}><ExternalLink className="w-3 h-3 mr-1" />{t('button.viewOffer')}</Button>
                                            )}
                                            <Button size="sm" onClick={() => {
                                                setServiceContactOpen(svc);
                                                setServiceMessage(t('booking.wantToBook'));
                                            }}>{t('button.contactStructure')}</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {services?.length === 0 && <p className="text-center text-gray-400 py-8">{t('empty.experiences')}</p>}
                    </div>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>{t('payments.extraExpenses')}</CardTitle><CardDescription>{t('payments.extraDesc')}</CardDescription></CardHeader>
                        <CardContent>
                            {payments?.map((pay: any) => (
                                <div key={pay.id} className="flex justify-between items-center p-3 border-b last:border-0">
                                    <div><p className="font-medium capitalize"><T text={pay.tipo?.replace('_', ' ')} /></p><p className="text-xs text-gray-500">Scad: {format(parseISO(pay.data_scadenza), 'dd MMM')}</p></div>
                                    <div className="text-right">
                                        <p className="font-bold">€{pay.importo}</p>
                                        {pay.stato === 'pagato' ? <Badge className="bg-green-100 text-green-800">{t('badge.paid')}</Badge> :
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => setPaymentTicketOpen(pay)}>{t('button.notify')}</Button>
                                        }
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

        {/* DIALOG CONTATTA STRUTTURA */}
        <Dialog open={!!serviceContactOpen} onOpenChange={() => setServiceContactOpen(null)}>
            <DialogContent className="max-w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>{t('dialog.contactStructure')}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">{t('dialog.contactServiceDesc', { service: serviceContactOpen?.titolo, price: serviceContactOpen?.prezzo })}</p>
                    <Textarea placeholder={t('placeholder.yourMessage')} value={serviceMessage} onChange={e => setServiceMessage(e.target.value)} rows={4} />
                </div>
                <DialogFooter><Button onClick={() => sendServiceContact.mutate()} disabled={!serviceMessage} className="w-full"><Send className="w-4 h-4 mr-2" />{t('button.sendMessage')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
