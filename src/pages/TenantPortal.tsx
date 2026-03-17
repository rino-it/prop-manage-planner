import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Home, FileText, Wrench, LogOut, Download, Euro, AlertTriangle, Plus, FileQuestion, Copy, UserCog, Utensils, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import LanguagePicker from '@/components/LanguagePicker';
import T from '@/components/TranslatedText';

export default function TenantPortal() {
  return (
    <LanguageProvider>
      <TenantPortalInner />
    </LanguageProvider>
  );
}

function TenantPortalInner() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({ titolo: '', descrizione: '', priorita: 'bassa' });
  const [paymentTicketOpen, setPaymentTicketOpen] = useState<any>(null);
  const [payPromise, setPayPromise] = useState({ date: '', method: '' });
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [isSavingContact, setIsSavingContact] = useState(false);

  // 1. Recupero Booking tramite ID
  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['tenant-booking', id],
    queryFn: async () => {
      if (!id) return null;
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`*, properties_real(id, nome, indirizzo, wifi_ssid, wifi_password)`)
        .eq('id', id)
        .maybeSingle();

      if (error) { console.error("Errore fetch booking:", error); return null; }
      if (!bookingData) return null;

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

  const { data: payments = [] } = useQuery({
    queryKey: ['tenant-payments', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data, error } = await supabase.from('tenant_payments').select('*').eq('booking_id', booking.id).order('data_scadenza', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!booking?.id
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tenant-tickets', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await supabase.from('tickets').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking?.id
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['tenant-documents', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', booking.id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!booking?.id
  });

  const { data: services = [] } = useQuery({
    queryKey: ['guest-services', booking?.property_id],
    queryFn: async () => {
        if (!booking?.property_id) return [];
        try {
            const { data, error } = await supabase.from('services').select('*').eq('attivo', true).contains('property_ids', [booking.property_id]);
            if (error) return [];
            return data || [];
        } catch { return []; }
    },
    enabled: !!booking?.property_id,
    retry: false
  });

  const hasContactInfo = booking?.telefono_ospite && booking?.email_ospite;

  const saveContactInfo = async () => {
    if (!contactForm.email || !contactForm.phone) return;
    setIsSavingContact(true);
    try {
      const { error } = await supabase.from('bookings').update({ email_ospite: contactForm.email, telefono_ospite: contactForm.phone }).eq('id', id);
      if (error) throw error;
      toast({ title: t('toast.contactsSaved') });
      queryClient.invalidateQueries({ queryKey: ['tenant-booking'] });
    } catch (e) { toast({ title: t('toast.contactsError'), variant: "destructive" }); }
    finally { setIsSavingContact(false); }
  };

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
      toast({ title: t('toast.reportSent') });
    }
  });

  const sendPaymentNotice = useMutation({
      mutationFn: async () => {
          if (!booking || !paymentTicketOpen) return;
          await supabase.from('tickets').insert({
              booking_id: booking.id,
              property_real_id: isReal ? property.id : null,
              titolo: `${t('payment.prefix')} ${paymentTicketOpen.tipo || 'Rata'}`,
              descrizione: t('payment.tenantWillPay', { date: format(new Date(payPromise.date), 'dd/MM/yyyy'), method: payPromise.method }),
              stato: 'aperto',
              creato_da: 'ospite',
              related_payment_id: paymentTicketOpen.id
          });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
          toast({ title: t('toast.noticeSent') });
          setPaymentTicketOpen(null);
      }
  });

  const downloadDoc = async (path: string) => {
    try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
        if (error || !data) throw new Error();
        window.open(data.signedUrl, '_blank');
    } catch {
        toast({ title: t('toast.downloadError'), variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('toast.copied'), duration: 1500 });
  };

  if (bookingLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  if (!booking) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center bg-slate-50">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4"/>
        <h1 className="text-2xl font-bold text-slate-800">{t('error.invalidLink')}</h1>
        <p className="text-slate-500 max-w-md mt-2">
            {t('error.invalidLinkDesc')}<br/>
            {t('error.searchedId')} <span className="font-mono text-xs bg-slate-100 p-1 rounded">{id}</span>
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
                <h1 className="font-bold text-sm text-slate-900 truncate max-w-[180px]">{isReal ? property?.nome : property?.veicolo}</h1>
                <p className="text-[10px] text-slate-500">{t('portal.tenant')}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <LanguagePicker />
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">{t('badge.active')}</Badge>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {!hasContactInfo && (
          <Card className="border-2 border-red-200 shadow-lg">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="flex justify-between items-center text-lg">
                <span className="text-red-700">{t('contact.completeProfile')}</span>
                <Lock className="text-red-500 w-6 h-6"/>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600 text-center">{t('contact.accessPrompt')}</p>
              <div className="space-y-3">
                <div><Label className="text-xs uppercase text-slate-500">{t('label.email')}</Label><Input placeholder={t('placeholder.email')} value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
                <div><Label className="text-xs uppercase text-slate-500">{t('label.phone')}</Label><Input placeholder={t('placeholder.phone')} value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} /></div>
              </div>
              <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={saveContactInfo} disabled={isSavingContact || !contactForm.email || !contactForm.phone}>
                {isSavingContact ? <Loader2 className="animate-spin w-4 h-4"/> : t('button.sendContacts')}
              </Button>
            </CardContent>
          </Card>
        )}

        {hasContactInfo && (<>
        <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
            <CardHeader>
                <CardTitle className="text-xl">{t('tenant.welcome')} {booking.nome_ospite}</CardTitle>
                <CardDescription className="text-slate-400">{t('tenant.stayUpdated')}</CardDescription>
            </CardHeader>
            {isReal && property?.wifi_password && (
                <CardFooter className="bg-white/5 border-t border-white/10">
                    <div className="flex justify-between items-center w-full py-1">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{t('label.wifiPassword')}</p>
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
                <TabsTrigger value="status" className="text-xs">{t('tab.status')}</TabsTrigger>
                <TabsTrigger value="services" className="text-xs">{t('tab.services')}</TabsTrigger>
                <TabsTrigger value="docs" className="text-xs">{t('tab.files')}</TabsTrigger>
                <TabsTrigger value="support" className="text-xs">{t('tab.help')}</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Euro className="w-4 h-4"/> {t('payments.plan')}</h3>
                {payments.length === 0 ? <p className="text-center text-gray-400 py-8 bg-white rounded-lg border">{t('empty.payments')}</p> : (
                    <div className="space-y-3">
                        {payments.map((pay: any) => (
                            <Card key={pay.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm capitalize"><T text={(pay.tipo || 'Rata').replace('_', ' ')} /></p>
                                        <p className="text-xs text-gray-500">Scad: {pay.data_scadenza ? format(new Date(pay.data_scadenza), 'dd MMM yyyy') : 'N/D'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg">€ {pay.importo}</p>
                                        {pay.stato === 'pagato' ? <Badge className="bg-green-100 text-green-700 border-0">{t('badge.paid')}</Badge> :
                                            <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-200 text-orange-600" onClick={() => setPaymentTicketOpen(pay)}>{t('button.notify')}</Button>
                                        }
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="services" className="space-y-4">
                <h3 className="font-bold text-slate-700">{t('services.available')}</h3>
                <div className="grid gap-3">
                    {services.map((svc: any) => (
                        <Card key={svc.id} className="overflow-hidden">
                            {svc.immagine_url && <img src={svc.immagine_url} className="h-32 w-full object-cover" />}
                            <CardContent className="p-4">
                                <h4 className="font-bold"><T text={svc.titolo} /></h4>
                                <p className="text-xs text-slate-500 mt-1"><T text={svc.descrizione} /></p>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="font-bold text-blue-600 text-sm">€{svc.prezzo}</span>
                                    <Button size="sm" onClick={() => { setNewTicketOpen(true); setTicketData({...ticketData, titolo: `${t('booking.serviceRequest')} ${svc.titolo}`}) }}>{t('button.request')}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {services.length === 0 && <p className="text-center text-gray-400 py-8">{t('empty.services')}</p>}
                </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4">
                <h3 className="font-bold text-slate-700">{t('docs.shared')}</h3>
                {documents.length === 0 ? <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-400"><FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-20"/><p>{t('empty.docs')}</p></div> : (
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
                    <Plus className="w-4 h-4 mr-2"/> {t('support.newReport')}
                </Button>
                <div className="space-y-3">
                    {tickets.map((ticket: any) => (
                        <Card key={ticket.id}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-sm"><T text={ticket.titolo || t('support.report')} /></h4>
                                    <Badge variant="outline" className="text-[10px]">{ticket.stato}</Badge>
                                </div>
                                <p className="text-xs text-slate-600 mb-2"><T text={ticket.descrizione} /></p>
                                {ticket.admin_notes && (
                                    <div className="bg-blue-50 p-2 rounded border border-blue-100 text-[11px] text-blue-800">
                                        <strong>{t('label.staff')}</strong> <T text={ticket.admin_notes} />
                                    </div>
                                )}
                                <p className="text-[9px] text-gray-400 text-right mt-1">{format(new Date(ticket.created_at), 'dd/MM/yyyy')}</p>
                            </CardContent>
                        </Card>
                    ))}
                    {tickets.length === 0 && <p className="text-center text-gray-400 py-8">{t('empty.reports')}</p>}
                </div>
            </TabsContent>
        </Tabs>
        </>)}
      </main>

      {/* DIALOG NUOVO TICKET */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>{t('support.newReport')}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>{t('placeholder.subject')}</Label><Input placeholder={t('placeholder.subjectExample')} value={ticketData.titolo} onChange={e => setTicketData({...ticketData, titolo: e.target.value})} /></div>
                <div className="space-y-2"><Label>{t('label.description')}</Label><Textarea placeholder={t('placeholder.details')} value={ticketData.descrizione} onChange={e => setTicketData({...ticketData, descrizione: e.target.value})} /></div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setNewTicketOpen(false)}>{t('button.cancel')}</Button>
                <Button onClick={() => handleCreateTicket.mutate()} className="bg-blue-600 w-full" disabled={!ticketData.titolo}>{t('button.send')}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG AVVISO PAGAMENTO */}
      <Dialog open={!!paymentTicketOpen} onOpenChange={() => setPaymentTicketOpen(null)}>
            <DialogContent className="w-[95vw] rounded-xl">
                <DialogHeader><DialogTitle>{t('dialog.notifyPayment')}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500">{t('dialog.paymentTenantDesc')} <strong>€{paymentTicketOpen?.importo}</strong>.</p>
                    <div className="space-y-2"><Label>{t('label.expectedDate')}</Label><Input type="date" value={payPromise.date} onChange={e => setPayPromise({...payPromise, date: e.target.value})} /></div>
                    <div className="space-y-2">
                        <Label>{t('label.method')}</Label>
                        <Select onValueChange={(v) => setPayPromise({...payPromise, method: v})}>
                            <SelectTrigger><SelectValue placeholder={t('placeholder.choose')}/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bonifico">{t('method.transfer')}</SelectItem>
                                <SelectItem value="contanti">{t('method.cash')}</SelectItem>
                                <SelectItem value="altro">{t('method.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => sendPaymentNotice.mutate()} disabled={!payPromise.date || !payPromise.method} className="w-full">{t('button.sendNotice')}</Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>
    </div>
  );
}
