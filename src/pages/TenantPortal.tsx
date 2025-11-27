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
import { Home, Droplet, Zap, Euro, FileText, Upload, Send } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function TenantPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ticketForm, setTicketForm] = useState({ titolo: '', descrizione: '' });
  const [uploading, setUploading] = useState(false);

  // 1. DATI CONTRATTO
  const { data: booking, isLoading } = useQuery({
    queryKey: ['tenant-booking', id],
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

  // 2. PAGAMENTI
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('booking_id', id)
        .order('data_scadenza', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  // 3. TICKET APERTI DA QUESTO INQUILINO
  const { data: myTickets } = useQuery({
    queryKey: ['tenant-tickets', id],
    queryFn: async () => {
        const { data } = await supabase
            .from('tickets')
            .select('*')
            .eq('booking_id', id)
            .order('created_at', { ascending: false });
        return data || [];
    },
    enabled: !!id
  });

  // MUTATION: CREA TICKET
  const createTicket = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      const { error } = await supabase.from('tickets').insert({
        booking_id: booking.id,
        property_real_id: booking.property_id,
        titolo: ticketForm.titolo,
        descrizione: ticketForm.descrizione,
        stato: 'aperto',
        creato_da: 'ospite'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-tickets'] });
      toast({ title: "Ticket inviato", description: "Il manager ha ricevuto la tua segnalazione." });
      setTicketForm({ titolo: '', descrizione: '' });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  // MUTATION: UPLOAD DOCUMENTO
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !booking) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `tenant_${booking.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('bookings')
        .update({ 
            documenti_url: fileName, 
            documenti_caricati: true,
            stato_documenti: 'in_revisione'
        })
        .eq('id', booking.id);

      if (dbError) throw dbError;

      toast({ title: "Documento inviato!", description: "Grazie per la collaborazione." });
      queryClient.invalidateQueries({ queryKey: ['tenant-booking'] });
      
    } catch (error: any) {
      console.error(error);
      toast({ title: "Errore upload", description: "Controlla i permessi o riprova.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !booking) return <div className="p-8 text-center">Caricamento portale...</div>;

  const daPagare = payments?.filter(p => p.stato === 'da_pagare').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;
  const getIcon = (tipo: string) => {
    if (tipo === 'bolletta_luce') return <Zap className="w-5 h-5 text-yellow-600" />;
    if (tipo === 'bolletta_gas' || tipo === 'acqua') return <Droplet className="w-5 h-5 text-blue-600" />;
    return <Home className="w-5 h-5 text-purple-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-4xl mx-auto">
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao, {booking.nome_ospite}</h1>
          <p className="text-gray-500 flex items-center gap-2 mt-1">
            <Home className="w-4 h-4" /> {booking.properties_real?.nome} — {booking.properties_real?.via}
          </p>
        </div>
        <div className={`px-6 py-3 rounded-lg border text-center min-w-[200px] ${daPagare > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs uppercase font-bold text-gray-500 mb-1">Da Saldare</p>
          <p className={`text-2xl font-bold ${daPagare > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            € {daPagare.toLocaleString()}
          </p>
        </div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="payments">Pagamenti</TabsTrigger>
          <TabsTrigger value="support">Assistenza</TabsTrigger>
          <TabsTrigger value="docs">Documenti</TabsTrigger>
        </TabsList>

        {/* TAB PAGAMENTI */}
        <TabsContent value="payments" className="space-y-4">
          {payments?.map((pay) => (
            <Card key={pay.id} className="border-l-4 overflow-hidden" style={{ borderLeftColor: pay.stato === 'pagato' ? '#22c55e' : '#f97316' }}>
              <CardContent className="p-0">
                <div className="flex items-center p-4">
                  <div className="p-3 bg-gray-100 rounded-full mr-4">{getIcon(pay.tipo || '')}</div>
                  <div className="flex-1">
                    <p className="font-bold capitalize text-gray-900">{pay.tipo?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-500">Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">€{pay.importo}</p>
                    <Badge variant={pay.stato === 'pagato' ? 'default' : 'secondary'}>{pay.stato?.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {payments?.length === 0 && <div className="text-center py-10 text-gray-400">Nessun pagamento registrato.</div>}
        </TabsContent>

        {/* TAB ASSISTENZA (TICKET) */}
        <TabsContent value="support" className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Hai un problema?</CardTitle><CardDescription>Apri un ticket al proprietario.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Oggetto (es. Caldaia guasta)" value={ticketForm.titolo} onChange={e => setTicketForm({...ticketForm, titolo: e.target.value})} />
                    <Textarea placeholder="Descrivi il problema..." value={ticketForm.descrizione} onChange={e => setTicketForm({...ticketForm, descrizione: e.target.value})} />
                    <Button className="w-full" onClick={() => createTicket.mutate()} disabled={!ticketForm.titolo}>
                        <Send className="w-4 h-4 mr-2" /> Invia Segnalazione
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-700">I tuoi Ticket recenti</h3>
                {myTickets?.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-lg border flex justify-between items-center">
                        <div>
                            <p className="font-medium">{t.titolo}</p>
                            <p className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd MMM yyyy')}</p>
                        </div>
                        <Badge variant={t.stato === 'risolto' ? 'default' : 'destructive'}>{t.stato}</Badge>
                    </div>
                ))}
            </div>
        </TabsContent>

        {/* TAB DOCUMENTI (UPLOAD) - FIX BUTTON */}
        <TabsContent value="docs">
           <Card className="border-dashed border-2">
            <CardContent className="py-10 flex flex-col items-center text-center">
                <Upload className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="font-bold text-gray-900">Carica Documenti</h3>
                <p className="text-sm text-gray-500 mb-4">Contratti firmati, ricevute bonifici, documenti identità.</p>
                
                <div className="flex justify-center">
                    <label 
                        className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Caricamento in corso..." : "Seleziona File"}
                        <input 
                            type="file" 
                            className="hidden" 
                            onChange={handleFileUpload} 
                            disabled={uploading} 
                        />
                    </label>
                </div>

                {booking.documenti_caricati && (
                    <div className="mt-6 bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center">
                        <FileText className="w-4 h-4 mr-2" /> Ultimo documento inviato con successo.
                    </div>
                )}
            </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}