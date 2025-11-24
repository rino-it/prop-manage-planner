import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Wifi, Key, Upload, CheckCircle, Lock, Clock, Ship, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function GuestPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);

  // 1. Recupera Dati
  const { data: booking, isLoading } = useQuery({
    queryKey: ['guest-booking', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, properties_real(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // 2. Servizi
  const { data: services } = useQuery({
    queryKey: ['guest-services'],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('attivo', true);
      return data;
    }
  });

  // 3. Upload con stato "IN REVISIONE"
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${booking.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      // AGGIORNAMENTO CRUCIALE: Imposta stato a "in_revisione"
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          documenti_url: fileName,
          documenti_caricati: true,
          stato_documenti: 'in_revisione' 
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ['guest-booking'] });
      toast({ title: "Inviato!", description: "Il manager verificherà il documento a breve." });

    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      await supabase.from('tickets').insert({
        booking_id: booking.id,
        titolo: ticketForm.titolo,
        descrizione: ticketForm.descrizione,
        stato: 'aperto'
      });
    },
    onSuccess: () => {
      toast({ title: "Segnalazione inviata" });
      setTicketForm({ titolo: '', descrizione: '' });
    }
  });

  if (isLoading || !booking) return <div className="p-8 text-center">Caricamento...</div>;

  // LOGICA STATI
  const isApproved = booking.stato_documenti === 'approvato';
  const isPending = booking.stato_documenti === 'in_revisione';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Benvenuto, {booking.nome_ospite}!</h1>
        <p className="text-gray-600 mt-2">Il tuo soggiorno a {booking.properties_real?.citta}</p>
      </div>

      <Card className={`mb-6 border-l-4 ${isApproved ? 'border-l-green-500' : isPending ? 'border-l-yellow-500' : 'border-l-orange-500'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isApproved ? <><CheckCircle className="text-green-600" /> Accesso Sbloccato</> : 
             isPending ? <><Clock className="text-yellow-600" /> Verifica in Corso</> :
             <><Lock className="text-orange-500" /> Check-in Richiesto</>}
          </CardTitle>
          <CardDescription>
            {isApproved ? "Documenti approvati. Ecco i tuoi codici:" : 
             isPending ? "Abbiamo ricevuto i documenti. Appena validati vedrai qui i codici." :
             "Carica il documento per sbloccare l'accesso."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isApproved ? (
            <div className="grid gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <p className="text-sm text-green-900">WiFi: <strong>{booking.properties_real?.wifi_ssid}</strong></p>
                <p className="text-sm text-green-900">Pass: <strong>{booking.properties_real?.wifi_password}</strong></p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-900">Keybox: <strong>{booking.properties_real?.codice_keybox}</strong></p>
              </div>
            </div>
          ) : isPending ? (
             <div className="text-center py-6 bg-yellow-50/50 rounded-lg">
                <Clock className="w-12 h-12 mx-auto text-yellow-400 mb-3 animate-pulse" />
                <p className="text-sm text-yellow-700">Stiamo controllando i tuoi documenti.</p>
             </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <label htmlFor="doc-upload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                {uploading ? "Caricamento..." : "Carica Foto Documento"}
                <input id="doc-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ... RESTO DELLA PAGINA UGUALE (SERVIZI/TICKET) ... */}
       <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="services">Esperienze</TabsTrigger>
          <TabsTrigger value="support">Assistenza</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4 space-y-4">
          {services?.map(service => (
            <Card key={service.id} className="overflow-hidden">
              <div className="flex h-24 sm:h-32">
                {service.immagine_url && (
                  <img src={service.immagine_url} className="w-24 sm:w-32 object-cover" alt={service.titolo} />
                )}
                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-bold">{service.titolo}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{service.descrizione}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-blue-600">€{service.prezzo}</span>
                    <Button size="sm" variant="outline" onClick={() => window.open(service.payment_link || service.link_prenotazione || '#', '_blank')}>
                      Prenota <Ship className="w-3 h-3 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="support" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assistenza Ospiti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input 
                placeholder="Oggetto" 
                value={ticketForm.titolo}
                onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})}
              />
              <Textarea 
                placeholder="Descrivi il problema..." 
                value={ticketForm.descrizione}
                onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})}
              />
              <Button className="w-full bg-red-600" onClick={() => createTicket.mutate()}>
                Richiedi Aiuto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}