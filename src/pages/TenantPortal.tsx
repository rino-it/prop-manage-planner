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
import { Home, Droplet, Zap, Euro, FileText, AlertCircle, Upload, MessageSquare, Send } from 'lucide-react';
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
        creato_da: 'ospite' // Importante per distinguerlo
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
      
      // 1. Upload su Storage
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      // 2. Aggiorna il DB (usiamo il campo generico documenti_url o ne creiamo uno logico)
      // Per semplicità qui aggiorniamo lo stato documenti della prenotazione
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
    } catch (error: any) {
      toast({ title: "Errore upload", description: error.message, variant: "destructive" });
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
            <Card key={pay.