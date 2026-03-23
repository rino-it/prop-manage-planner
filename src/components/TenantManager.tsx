import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Ticket, Wallet, MessageCircle, ExternalLink, Share2, UserCog } from 'lucide-react'; 
import { format, parseISO } from 'date-fns';
import TicketManager from '@/components/TicketManager';
import { useToast } from '@/hooks/use-toast';

export default function TenantManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // STATI PER I DIALOG
  const [selectedTicketTenant, setSelectedTicketTenant] = useState<string | null>(null);
  const [selectedPaymentTenant, setSelectedPaymentTenant] = useState<string | null>(null);
  
  // NUOVO STATO: Apre il pannello di gestione ticket avanzato
  const [ticketManagerOpen, setTicketManagerOpen] = useState<any>(null); 

  // 1. CARICA INQUILINI
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, properties_real(nome), tenant_profiles(*)')
        .eq('tipo_affitto', 'lungo')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // 2. CARICA TICKET (Solo quando apro il dialog storico)
  const { data: tickets } = useQuery({
    queryKey: ['tenant-tickets-detail', selectedTicketTenant],
    queryFn: async () => {
      if (!selectedTicketTenant) return [];
      const { data } = await supabase
        .from('tickets')
        .select('*, bookings(nome_ospite, telefono_ospite, properties_real(nome))')
        .eq('booking_id', selectedTicketTenant)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedTicketTenant
  });

  // 3. CARICA PAGAMENTI (Solo quando apro il dialog pagamenti)
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments-detail', selectedPaymentTenant],
    queryFn: async () => {
      if (!selectedPaymentTenant) return [];
      const { data } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('booking_id', selectedPaymentTenant)
        .order('data_scadenza', { ascending: true });
      return data || [];
    },
    enabled: !!selectedPaymentTenant
  });

  // HELPER FUNCTIONS (WhatsApp, Calendar, etc.)
  const sendWhatsApp = (phone: string, amount: number, date: string, type: string) => {
    if (!phone) {
        toast({ 
            title: "Numero mancante", 
            description: "Non è stato salvato un numero di telefono per questo inquilino.", 
            variant: "destructive" 
        });
        return;
    }
    
    const text = `Ciao, ti ricordo la scadenza di €${amount} relativa a ${type} per il giorno ${format(parseISO(date), 'dd/MM/yyyy')}. Grazie.`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const addToGoogleCal = (amount: number, date: string, propertyName: string) => {
    const title = `Incasso Affitto: ${propertyName}`;
    const details = `Importo atteso: €${amount}`;
    const d = format(parseISO(date), 'yyyyMMdd');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${d}/${d}`;
    window.open(url, '_blank');
  };

  const downloadIcs = async (amount: number, date: string, propertyName: string) => {
    const title = `Incasso Affitto: ${propertyName}`;
    const d = format(parseISO(date), 'yyyyMMdd');
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${d}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Importo atteso €${amount}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const fileName = `incasso_${d}.ics`;
    const file = new File([icsContent], fileName, { type: 'text/calendar' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: title,
                text: 'Aggiungi evento al calendario'
            });
            return;
        } catch (error) {
            console.log("Condivisione annullata");
        }
    }

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Caricamento inquilini...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Operativa Inquilini</h1>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 px-3 py-1">{tenants?.length} Attivi</Badge>
      </div>
      
      {/* GRIGLIA INQUILINI */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tenants?.map((booking) => (
            <Card key={booking.id} className="hover:shadow-lg transition-all border-t-4 border-t-purple-600">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      {booking.nome_ospite}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1 truncate max-w-[200px]">{booking.properties_real?.nome}</p>
                  </div>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                      (booking.tenant_profiles?.[0]?.compliance_score || 100) > 80 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}>
                      {booking.tenant_profiles?.[0]?.compliance_score || 100}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                    <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2 border-dashed border-gray-300 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700"
                        onClick={() => setSelectedTicketTenant(booking.id)}
                    >
                        <Ticket className="w-6 h-6" />
                        <span className="text-xs font-semibold">Storico Ticket</span>
                    </Button>

                    <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2 border-dashed border-gray-300 hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                        onClick={() => setSelectedPaymentTenant(booking.id)}
                    >
                        <Wallet className="w-6 h-6" />
                        <span className="text-xs font-semibold">Piano Pagamenti</span>
                    </Button>
                </div>

                <div className="text-xs text-center text-gray-400">
                    Contratto scade il: {booking.data_fine ? format(parseISO(booking.data_fine), 'dd MMM yyyy') : 'N/D'}
                </div>
              </CardContent>
            </Card>
        ))}
      </div>

      {/* --- DIALOG STORICO TICKET (Con Bottone GESTISCI) --- */}
      <Dialog open={!!selectedTicketTenant} onOpenChange={(open) => !open && setSelectedTicketTenant(null)}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Storico Segnalazioni</DialogTitle>
                <DialogDescription>Elenco completo dei ticket aperti da questo inquilino.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3 mt-2">
                    {tickets?.map(t => (
                        <div key={t.id} className="p-3 border rounded-lg bg-gray-50 text-sm">
                            <div className="flex justify-between font-semibold mb-1">
                                <span>{t.titolo}</span>
                                <Badge variant={t.stato === 'risolto' ? 'secondary' : 'destructive'} className="text-[10px]">{t.stato}</Badge>
                            </div>
                            <p className="text-gray-600 text-xs mb-2">{t.descrizione}</p>
                            
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                                <span className="text-gray-400 text-[10px]">{format(parseISO(t.created_at), 'dd MMM')}</span>
                                {/* BOTTONE CHE APRE IL NUOVO TICKET MANAGER */}
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 text-xs bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={() => setTicketManagerOpen(t)} 
                                >
                                    <UserCog className="w-3 h-3 mr-1" /> Gestisci
                                </Button>
                            </div>
                        </div>
                    ))}
                    {tickets?.length === 0 && <p className="text-center py-10 text-gray-400">Nessun ticket presente.</p>}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG PIANO PAGAMENTI --- */}
      <Dialog open={!!selectedPaymentTenant} onOpenChange={(open) => !open && setSelectedPaymentTenant(null)}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>Scadenze & Incassi</DialogTitle>
                <DialogDescription>Gestisci i solleciti e il calendario incassi.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3 mt-2">
                    {payments?.map(p => {
                        const currentTenant = tenants?.find(t => t.id === selectedPaymentTenant);
                        const phone = currentTenant?.telefono_ospite;
                        const propName = currentTenant?.properties_real?.nome || 'Affitto';

                        return (
                            <div key={p.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <div>
                                        <p className="font-bold capitalize text-gray-900">{p.tipo?.replace('_', ' ')}</p>
                                        <p className="text-xs text-gray-500">Scadenza: {format(parseISO(p.data_scadenza), 'dd MMM yyyy')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-blue-600">€{p.importo}</p>
                                        <Badge variant={p.stato === 'pagato' ? 'default' : 'outline'}>{p.stato}</Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => sendWhatsApp(phone || '', p.importo, p.data_scadenza, p.tipo || 'rata')}>
                                        <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs" onClick={() => addToGoogleCal(p.importo, p.data_scadenza, propName)}>
                                        <ExternalLink className="w-3 h-3 mr-1" /> Google
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-100 text-xs" onClick={() => downloadIcs(p.importo, p.data_scadenza, propName)}>
                                        <Share2 className="w-3 h-3 mr-1" /> Apple/iCal
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    {payments?.length === 0 && <p className="text-center py-10 text-gray-400">Nessun pagamento programmato.</p>}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* --- NUOVO COMPONENTE: TICKET MANAGER --- */}
      {ticketManagerOpen && (
        <TicketManager 
            ticket={ticketManagerOpen} 
            isOpen={!!ticketManagerOpen} 
            onClose={() => setTicketManagerOpen(null)}
            onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['tenant-tickets-detail'] });
            }}
        />
      )}

    </div>
  );
}