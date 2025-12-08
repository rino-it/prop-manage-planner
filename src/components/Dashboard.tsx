import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  User,
  Wrench,
  Info,
  ArrowRight
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';

// Props per gestire la navigazione interna
interface DashboardProps {
  setActiveTab?: (tab: string) => void;
}

type DashboardEvent = {
  id: string;
  date: Date;
  type: 'checkin' | 'checkout' | 'payment' | 'maintenance';
  title: string;
  subtitle: string;
  priority: 'alta' | 'media' | 'bassa';
  status: string;
  targetTab?: string;
};

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const startMonth = startOfMonth(new Date()).toISOString();
  const endMonth = endOfMonth(new Date()).toISOString();

  // 1. QUERY PRENOTAZIONI
  const { data: bookings } = useQuery({
    queryKey: ['dashboard-bookings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id, data_inizio, data_fine, nome_ospite, properties_real(nome)')
        .or(`data_inizio.gte.${startMonth},data_fine.lte.${endMonth}`);
      return data || [];
    }
  });

  // 2. QUERY FINANZA
  const { data: finances } = useQuery({
    queryKey: ['dashboard-finances'],
    queryFn: async () => {
      const { data: income } = await supabase.from('tenant_payments').select('*').gte('data_scadenza', startMonth).lte('data_scadenza', endMonth);
      const { data: expenses } = await supabase.from('property_expenses').select('*').gte('date', startMonth).lte('date', endMonth);
      const { data: overdue } = await supabase.from('tenant_payments').select('*').eq('stato', 'da_pagare').lt('data_scadenza', new Date().toISOString());
      return { income: income || [], expenses: expenses || [], overdue: overdue || [] };
    }
  });

  // 3. QUERY TICKET
  const { data: tickets } = useQuery({
    queryKey: ['dashboard-tickets'],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*, properties_real(nome)').neq('stato', 'risolto');
      return data || [];
    }
  });

  // ELABORAZIONE DATI
  const dashboardData = useMemo(() => {
    const events: DashboardEvent[] = [];

    bookings?.forEach(b => {
      events.push({
        id: `in-${b.id}`, date: new Date(b.data_inizio), type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta', status: 'pending', targetTab: 'bookings'
      });
      events.push({
        id: `out-${b.id}`, date: new Date(b.data_fine), type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta', status: 'pending', targetTab: 'bookings'
      });
    });

    finances?.income.forEach(inc => {
      events.push({
        id: `pay-${inc.id}`, date: new Date(inc.data_scadenza), type: 'payment',
        title: `Incasso: €${inc.importo}`, subtitle: inc.description || 'Rata',
        priority: 'media', status: inc.stato || 'da_pagare', targetTab: 'revenue'
      });
    });

    const kpi = {
      incassato: finances?.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      atteso: finances?.income.filter(i => i.stato === 'da_pagare' || i.stato === 'in_verifica').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      uscite: finances?.expenses.reduce((acc, c) => acc + Number(c.amount), 0) || 0
    };

    const urgencies = [
      ...(tickets?.filter(t => t.priorita === 'alta' || t.priorita === 'critica').map(t => ({
        type: 'ticket', text: `GUASTO: ${t.titolo} (${t.properties_real?.nome})`, id: t.id, targetTab: 'activities'
      })) || []),
      ...(finances?.overdue.map(o => ({
        type: 'payment', text: `SCADUTO: €${o.importo} - ${o.description}`, id: o.id, targetTab: 'revenue'
      })) || [])
    ];

    return { events, kpi, urgencies };
  }, [bookings, finances, tickets]);

  const dailyEvents = dashboardData.events.filter(e => selectedDate && isSameDay(e.date, selectedDate));

  const modifiers = {
    hasEvent: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date)),
    hasUrgency: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && e.type === 'maintenance'),
  };

  const safeNavigate = (tab: string) => {
    if (setActiveTab) setActiveTab(tab);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Torre di Controllo</h1>
          <p className="text-gray-500">Panoramica operativa del {format(new Date(), 'MMMM yyyy', { locale: it })}</p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{format(new Date(), 'EEEE d MMMM', { locale: it })}</p>
        </div>
      </div>

      {/* URGENZE */}
      {dashboardData.urgencies.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 shadow-sm animate-pulse">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold text-lg ml-2">Attenzione Richiesta ({dashboardData.urgencies.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
              {dashboardData.urgencies.map((u, idx) => (
                // @ts-ignore
                <li key={idx} className="cursor-pointer underline hover:text-red-700" onClick={() => safeNavigate(u.targetTab)}>
                  {u.text}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* LAYOUT GRID RESPONSIVE: Mobile=Colonna, Desktop=Griglia */}
      {/* L'ordine su mobile è controllato dalle classi 'order-1', 'order-2', ecc. */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">

        {/* 1. AGENDA GIORNALIERA (Mobile: PRIMA POSIZIONE order-1) */}
        <div className="order-1 md:order-3 md:col-span-2">
            <Card className="shadow-md border-slate-200 h-full border-t-4 border-t-blue-600">
                <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <CalendarIcon className="w-6 h-6 text-blue-600"/>
                            Agenda del {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Giorno'}
                        </CardTitle>
                        <Badge variant="secondary" className="text-sm px-3 py-1">{dailyEvents.length} Attività</Badge>
                    </div>
                </CardHeader>
                
                <ScrollArea className="h-[350px]">
                    {dailyEvents.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {dailyEvents.map((evt) => (
                                <div key={evt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 cursor-pointer" onClick={() => evt.targetTab && safeNavigate(evt.targetTab)}>
                                    <div className={`mt-1 p-2 rounded-full ${
                                        evt.type === 'checkin' ? 'bg-green-100 text-green-700' :
                                        evt.type === 'checkout' ? 'bg-orange-100 text-orange-700' :
                                        evt.type === 'payment' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {evt.type === 'checkin' && <User className="w-5 h-5" />}
                                        {evt.type === 'checkout' && <TrendingDown className="w-5 h-5" />}
                                        {evt.type === 'payment' && <TrendingUp className="w-5 h-5" />}
                                        {evt.type === 'maintenance' && <Wrench className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-base font-bold text-gray-900">{evt.title}</h4>
                                        <p className="text-sm text-gray-500 flex items-center mt-1">
                                            <MapPin className="w-3 h-3 mr-1" /> {evt.subtitle}
                                        </p>
                                    </div>
                                    <div className="self-center">
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                        <ArrowRight className="h-4 w-4 opacity-50" />
                                      </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                            <CheckCircle className="w-16 h-16 mb-4 text-green-100" />
                            <p className="font-medium text-lg text-gray-500">Tutto tranquillo per oggi.</p>
                            <p className="text-sm text-gray-400">Controlla il calendario per i prossimi impegni.</p>
                            <Button variant="link" onClick={() => setSelectedDate(new Date())} className="mt-2 text-blue-600">Torna a Oggi</Button>
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>

        {/* 2. KPI FINANZIARI (Mobile: SECONDA POSIZIONE order-2) */}
        <div className="order-2 md:order-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-50 border-green-200 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => safeNavigate('revenue')}>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Incassato (Mese)</p>
                <h2 className="text-3xl font-bold text-green-900">€ {dashboardData.kpi.incassato.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-white/50 rounded-full text-green-700 border border-green-200"><TrendingUp className="w-6 h-6" /></div>
            </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => safeNavigate('revenue')}>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">In Attesa</p>
                <h2 className="text-3xl font-bold text-blue-900">€ {dashboardData.kpi.atteso.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-white/50 rounded-full text-blue-700 border border-blue-200"><Clock className="w-6 h-6" /></div>
            </CardContent>
            </Card>
            
            <Card className="bg-red-50 border-red-200 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => safeNavigate('expenses')}>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Uscite</p>
                <h2 className="text-3xl font-bold text-red-900">€ {dashboardData.kpi.uscite.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-white/50 rounded-full text-red-700 border border-red-200"><TrendingDown className="w-6 h-6" /></div>
            </CardContent>
            </Card>
        </div>

        {/* 3. CALENDARIO (Mobile: TERZA POSIZIONE order-3) */}
        <div className="order-3 md:order-2 md:col-span-1">
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarIcon className="w-5 h-5 text-gray-500"/> Calendario
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={it}
                        className="rounded-md border p-3 w-full flex justify-center"
                        modifiers={modifiers}
                        modifiersStyles={{
                            hasEvent: { fontWeight: 'bold', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '50%' },
                            hasUrgency: { color: 'red', fontWeight: 'bold' }
                        }}
                    />
                    {/* LEGENDA AGGIUNTA */}
                    <div className="mt-4 flex items-start gap-2 text-xs text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-100 w-full">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p>
                           I giorni in <b>blu</b> hanno attività. <b>Tocca un giorno</b> per aggiornare l'agenda in alto.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}