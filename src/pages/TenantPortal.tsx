import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Droplet, Zap, Euro, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TenantPortal() {
  const { id } = useParams(); // ID Prenotazione (Booking)

  // 1. Recupera Dati Contratto
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
    }
  });

  // 2. Recupera Pagamenti e Spese (Tabella tenant_payments)
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('booking_id', id)
        .order('data_scadenza', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Caricamento portale...</div>;
  if (!booking) return <div className="p-8 text-center text-red-500">Contratto non trovato.</div>;

  // Calcoli rapidi
  const daPagare = payments?.filter(p => p.stato === 'da_pagare').reduce((acc, curr) => acc + Number(curr.importo), 0) || 0;
  const scaduti = payments?.filter(p => p.stato === 'scaduto').length || 0;

  const getIcon = (tipo: string) => {
    if (tipo === 'bolletta_luce') return <Zap className="w-5 h-5 text-yellow-600" />;
    if (tipo === 'bolletta_gas' || tipo === 'acqua') return <Droplet className="w-5 h-5 text-blue-600" />;
    if (tipo === 'affitto') return <Home className="w-5 h-5 text-purple-600" />;
    return <Euro className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-4xl mx-auto">
      
      {/* HEADER BENVENUTO */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao, {booking.nome_ospite}</h1>
          <p className="text-gray-500 flex items-center gap-2 mt-1">
            <Home className="w-4 h-4" /> {booking.properties_real?.nome} — {booking.properties_real?.via}
          </p>
        </div>
        <div className={`px-6 py-3 rounded-lg border text-center min-w-[200px] ${daPagare > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs uppercase font-bold text-gray-500 mb-1">Saldo Attuale</p>
          <p className={`text-2xl font-bold ${daPagare > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {daPagare > 0 ? `€ -${daPagare.toLocaleString()}` : "Tutto pagato"}
          </p>
        </div>
      </div>

      {/* ALERT SCADENZE */}
      {scaduti > 0 && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center gap-3">
          <AlertCircle className="text-red-600 w-6 h-6" />
          <div>
            <h3 className="font-bold text-red-800">Attenzione</h3>
            <p className="text-sm text-red-700">Hai {scaduti} pagamenti scaduti. Ti preghiamo di regolarizzare.</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="payments">Pagamenti & Utenze</TabsTrigger>
          <TabsTrigger value="docs">Documenti</TabsTrigger>
        </TabsList>

        {/* TABELLA PAGAMENTI */}
        <TabsContent value="payments" className="space-y-4">
          {payments?.map((pay) => (
            <Card key={pay.id} className="border-l-4 overflow-hidden" style={{ borderLeftColor: pay.stato === 'pagato' ? '#22c55e' : pay.stato === 'scaduto' ? '#ef4444' : '#f97316' }}>
              <CardContent className="p-0">
                <div className="flex items-center p-4">
                  <div className="p-3 bg-gray-100 rounded-full mr-4">{getIcon(pay.tipo || '')}</div>
                  <div className="flex-1">
                    <p className="font-bold capitalize text-gray-900">{pay.tipo?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-500">Scadenza: {format(new Date(pay.data_scadenza), 'dd MMM yyyy')}</p>
                    {pay.consumo_kw_mc && <p className="text-xs text-blue-600 mt-1 font-medium">Consumo rilevato: {pay.consumo_kw_mc} unità</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">€{pay.importo}</p>
                    <Badge variant="outline" className={`mt-1 ${
                      pay.stato === 'pagato' ? 'text-green-700 bg-green-50 border-green-200' : 
                      pay.stato === 'scaduto' ? 'text-red-700 bg-red-50 border-red-200' : 
                      'text-orange-700 bg-orange-50 border-orange-200'
                    }`}>
                      {pay.stato?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {payments?.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">
              <Euro className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nessuna spesa o affitto registrato ancora.</p>
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTI (Placeholder) */}
        <TabsContent value="docs">
           <Card>
            <CardHeader><CardTitle>I tuoi documenti</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded text-blue-600"><FileText className="w-5 h-5" /></div>
                  <span className="font-medium">Contratto di Locazione.pdf</span>
                </div>
                <Badge variant="secondary">Scarica</Badge>
              </div>
            </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}