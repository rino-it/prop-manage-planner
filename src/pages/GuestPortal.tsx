import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Home, Wifi, MapPin, FileText, Upload, Send, CheckCircle, XCircle, Clock, Key } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function GuestPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);

  // 1. DATI PRENOTAZIONE
  const { data: booking, isLoading } = useQuery({
    queryKey: ['guest-booking', id],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(*)').eq('id', id).single();
      return data;
    },
    enabled: !!id
  });

  // 2. EXTRA / PAGAMENTI (Se presenti)
  const { data: payments } = useQuery({
    queryKey: ['guest-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_payments').select('*').eq('booking_id', id).order('data_scadenza', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 3. DOCUMENTI (Nuova Tabella Storico)
  const { data: documents } = useQuery({
    queryKey: ['guest-docs', id],
    queryFn: async () => {
      const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', id).order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 4. TICKET
  const { data: myTickets } = useQuery({
      queryKey: ['guest-tickets', id],
      queryFn: async () => {
          const { data } = await supabase.from('tickets').select('*').eq('booking_id', id).order('created_at', { ascending: false });
          return data || [];
      },
      enabled: !!id
  });

  // UPLOAD LOGIC (FIXED BUTTON)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `guest_${booking.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('booking_documents').insert({
        booking_id: booking.id,
        filename: file.name,
        file_url: fileName,
        status: 'in_revisione'
      });

      if (dbError) throw dbError;

      toast({ title: "Documento inviato", description: "Grazie! Lo verificheremo a breve." });
      queryClient.invalidateQueries({ queryKey: ['guest-docs'] });
      
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // CREA TICKET
  const createTicket = useMutation({
      mutationFn: async () => {
        if (!booking) return;
        await supabase.from('tickets').insert({
          booking_id: booking.id,
          property_real_id: booking.property_id,
          titolo: ticketForm.titolo,
          descrizione: ticketForm.descrizione,
          stato: 'aperto',
          creato_da: 'ospite'
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['guest-tickets'] });
        toast({ title: "Richiesta inviata", description: "Ti risponderemo al più presto." });
        setTicketForm({ titolo: '', descrizione: '' });
      }
  });

  if (isLoading || !booking) return <div className="p-8 text-center">Caricamento portale ospite...</div>;

  const getStatusBadge = (status: string) => {
      if (status === 'approvato') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1"/> OK</Badge>;
      if (status === 'rifiutato') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1"/> No</Badge>;
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1"/> In Verifica</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto">
      
      {/* HEADER BENVENUTO */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
        <div className="bg-blue-600 h-24 relative">
            <div className="absolute -bottom-10 left-6 p-4 bg-white rounded-xl shadow border">
                <Home className="w-8 h-8 text-blue-600" />
            </div>
        </div>
        <div className="pt-12 px-6 pb-6">
            <h1 className="text-2xl font-bold text-gray-900">Benvenuto, {booking.nome_ospite}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {booking.properties_real?.nome}</span>
                <span className="flex items-center"><Wifi className="w-4 h-4 mr-1" /> WiFi: {booking.properties_real?.wifi_ssid || 'Chiedi'}</span>
                <span className="flex items-center"><Key className="w-4 h-4 mr-1" /> Check-in: {format(new Date(booking.data_inizio), 'dd MMM')}</span>
            </div>
        </div>
      </div>

      <Tabs defaultValue="docs" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="info">Info & Extra</TabsTrigger>
          <TabsTrigger value="support">Assistenza</TabsTrigger>
          <TabsTrigger value="docs">Documenti</TabsTrigger>
        </TabsList>

        {/* TAB 1: INFO E PAGAMENTI EXTRA */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Riepilogo Costi</CardTitle><CardDescription>Eventuali extra o tassa di soggiorno.</CardDescription></CardHeader>
            <CardContent>
                {payments?.map((pay) => (
                    <div key={pay.id} className="flex justify-between items-center p-3 border-b last:border-0">
                        <div>
                            <p className="font-medium capitalize">{pay.tipo?.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-500">{format(new Date(pay.data_scadenza), 'dd MMM')}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">€{pay.importo}</p>
                            <Badge variant="outline">{pay.stato}</Badge>
                        </div>
                    </div>
                ))}
                {payments?.length === 0 && <p className="text-center text-gray-400 py-4">Nessun costo extra da saldare.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ASSISTENZA / TICKET */}
        <TabsContent value="support" className="space-y-6">
           <Card>
                <CardHeader><CardTitle>Hai bisogno di aiuto?</CardTitle><CardDescription>Segnala un guasto o fai una richiesta.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Oggetto (es. Info parcheggio)" value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                    <Textarea placeholder="Scrivi qui..." value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} />
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}>
                        <Send className="w-4 h-4 mr-2" /> Invia Richiesta
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-700">Le tue richieste</h3>
                {myTickets?.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-lg border flex justify-between items-center">
                        <div>
                            <p className="font-medium">{t.titolo}</p>
                            <p className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd MMM')}</p>
                        </div>
                        <Badge variant={t.stato === 'risolto' ? 'default' : 'secondary'}>{t.stato}</Badge>
                    </div>
                ))}
            </div>
        </TabsContent>

        {/* TAB 3: DOCUMENTI (Check-in Online) */}
        <TabsContent value="docs">
           <Card className="border-dashed border-2 mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="py-8 flex flex-col items-center text-center">
                <div className="p-3 bg-white rounded-full mb-3"><Upload className="w-6 h-6 text-blue-600" /></div>
                <h3 className="font-bold text-gray-900">Check-in Online</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-xs">Carica qui la foto dei documenti (Passaporto/Carta d'Identità) di tutti gli ospiti.</p>
                
                <div className="flex justify-center">
                    <label className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-white hover:bg-gray-100 text-blue-700 h-10 px-6 py-2 shadow-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {uploading ? "Caricamento..." : "Seleziona Foto/PDF"}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                </div>
            </CardContent>
           </Card>

           <div className="space-y-3">
                <h3 className="font-bold text-gray-700 mb-2">File Inviati</h3>
                {documents?.map(doc => (
                    <div key={doc.id} className="bg-white p-4 rounded-lg border flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div className="overflow-hidden">
                                <p className="font-medium text-sm truncate w-40">{doc.filename}</p>
                                <p className="text-xs text-gray-400">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p>
                            </div>
                        </div>
                        {getStatusBadge(doc.status)}
                    </div>
                ))}
                {documents?.length === 0 && <p className="text-center text-gray-400 text-sm italic">Nessun documento caricato.</p>}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}