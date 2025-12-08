import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  MapPin, 
  User, 
  Wrench,
  PlusCircle,
  Wallet,
  ClipboardList
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// Tipi per gli eventi del calendario
type DashboardEvent = {
  id: string;
  date: Date;
  type: 'checkin' | 'checkout' | 'payment' | 'maintenance';
  title: string;
  subtitle: string;
  priority: 'alta' | 'media' | 'bassa';
  status: string;
  actionLink: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const startMonth = startOfMonth(new Date()).toISOString();
  const endMonth = endOfMonth(new Date()).toISOString();

  // 1. QUERY: PRENOTAZIONI
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

  // 2. QUERY: BILANCIO
  const { data: finances } = useQuery({
    queryKey: ['dashboard-finances'],
    queryFn: async () => {
      const { data: income } = await supabase
        .from('tenant_payments')
        .select('*')
        .gte('data_scadenza', startMonth)
        .lte('data_scadenza', endMonth);

      const { data: expenses } = await supabase
        .from('property_expenses')
        .select('*')
        .gte('date', startMonth)
        .lte('date', endMonth);

      const { data: overdue } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('stato', 'da_pagare')
        .lt('data_scadenza', new Date().toISOString());

      return { income: income || [], expenses: expenses || [], overdue: overdue || [] };
    }
  });

  // 3. QUERY: TICKET URGENTI
  const { data: tickets } = useQuery({
    queryKey: ['dashboard-tickets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tickets')
        .select('*, properties_real(nome)')
        .neq('stato', 'risolto');
      return data || [];
    }
  });

  // ELABORAZIONE DATI
  const dashboardData = useMemo(() => {
    const events: DashboardEvent[] = [];
    
    bookings?.forEach(b => {
      events.push({
        id: `in-${b.id}`,
        date: new Date(b.data_inizio),
        type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`,
        subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta',
        status: 'pending',
        actionLink: `/bookings`
      });
      events.push({
        id: `out-${b.id}`,
        date: new Date(b.data_fine),
        type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`,
        subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta',
        status: 'pending',
        actionLink: `/bookings`
      });
    });

    finances?.income.forEach(inc => {
      events.push({
        id: `pay-${inc.id}`,
        date: new Date(inc.data_scadenza),
        type: 'payment',
        title: `Incasso: €${inc.importo}`,
        subtitle: inc.description || 'Canone',
        priority: 'media',
        status: inc.stato || 'da_pagare',
        actionLink: `/revenue`
      });
    });

    const kpi = {
      incassato: finances?.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      atteso: finances?.income.filter(i => i.stato !== 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      uscite: finances?.expenses.reduce((acc, c) => acc + Number(c.amount), 0) || 0
    };

    const urgencies = [
      ...(tickets?.filter(t => t.priorita === 'alta' || t.priorita === 'critica').map(t => ({
        type: 'ticket', 
        text: `GUASTO: ${t.titolo}`, 
        subtext: t.properties_real?.nome,
        id: t.id, 
        link: '/activities'
      })) || []),
      ...(finances?.overdue.map(o => ({
        type: 'payment', 
        text: `SCADUTO: €${o.importo}`, 
        subtext: o.description,
        id: o.id, 
        link: '/revenue'
      })) || [])
    ];

    return { events, kpi, urgencies };
  }, [bookings, finances, tickets]);

  const dailyEvents = dashboardData.events.filter(e => 
    selectedDate && isSameDay(e.date, selectedDate)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER + AZIONI RAPIDE (NOVITÀ: Pulsanti grandi e chiari) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Benvenuto</h1>
          <p className="text-gray-500">Ecco cosa sta succedendo oggi nelle tue proprietà.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button className="bg-blue-600 shadow-md hover:bg-blue-700 whitespace-nowrap" onClick={() => navigate('/bookings')}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nuova Prenotazione
            </Button>
            <Button variant="outline" className="border-green-600 text-green-700 bg-green-50 hover:bg-green-100 whitespace-nowrap" onClick={() => navigate('/revenue')}>
                <Wallet className="mr-2 h-4 w-4" /> Registra Incasso
            </Button>
            <Button variant="outline" className="border-orange-400 text-orange-700 bg-orange-50 hover:bg-orange-100 whitespace-nowrap" onClick={() => navigate('/activities')}>
                <Wrench className="mr-2 h-4 w-4" /> Segnala Guasto
            </Button>
        </div>
      </div>

      {/* SEZIONE URGENZE (Visibile solo se serve) */}
      {dashboardData.urgencies.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full text-red-600 animate-pulse">
                <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
                <h3 className="font-bold text-red-900">Ci sono {dashboardData.urgencies.length} questioni urgenti!</h3>
                <p className="text-sm text-red-700">Controlla subito i pagamenti scaduti o i guasti critici.</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => navigate(dashboardData.urgencies[0].link)}>
            Risolvi Ora <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </div>
      )}

      {/* KPI FINANZIARI (Design a Card "Box") */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">Incassato (Mese)</p>
                    <h2 className="text-3xl font-bold text-gray-900 mt-2">€ {dashboardData.kpi.incassato.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-green-50 text-green-600 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-700 bg-green-50 px-2 py-1 rounded w-fit">
                <CheckCircle className="w-3 h-3 mr-1" /> Flusso regolare
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">In Attesa</p>
                    <h2 className="text-3xl font-bold text-gray-900 mt-2">€ {dashboardData.kpi.atteso.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock className="w-6 h-6" /></div>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded w-fit">
                Previsto entro fine mese
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-400 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">Spese Totali</p>
                    <h2 className="text-3xl font-bold text-gray-900 mt-2">€ {dashboardData.kpi.uscite.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-red-50 text-red-500 rounded-xl"><TrendingDown className="w-6 h-6" /></div>
            </div>
             <div className="mt-4 flex items-center text-xs text-red-700 bg-red-50 px-2 py-1 rounded w-fit">
                Monitorare costi
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AGENDA E CALENDARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLONNA SX: CALENDARIO */}
        <div className="lg:col-span-1">
            <Card className="h-full border-gray-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarIcon className="w-5 h-5 text-blue-600"/> Calendario
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center p-4">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={it}
                        className="rounded-md border p-3"
                        modifiers={{
                            hasEvent: (date) => dashboardData.events.some(e => isSameDay(e.date, date)),
                        }}
                        modifiersStyles={{
                            hasEvent: { fontWeight: 'bold', color: '#2563eb', textDecoration: 'underline' }
                        }}
                    />
                </CardContent>
            </Card>
        </div>

        {/* COLONNA DX: AGENDA GIORNALIERA */}
        <div className="lg:col-span-2">
            <Card className="h-full border-gray-200 shadow-sm flex flex-col">
                <CardHeader className="bg-slate-50 border-b pb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-xl">Agenda del Giorno</CardTitle>
                            <CardDescription>{selectedDate ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: it }) : 'Seleziona una data'}</CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-sm px-3 py-1 bg-white border shadow-sm">
                            {dailyEvents.length} Eventi
                        </Badge>
                    </div>
                </CardHeader>
                
                <ScrollArea className="flex-1 h-[350px]">
                    {dailyEvents.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {dailyEvents.map((evt) => (
                                <div key={evt.id} className="p-4 hover:bg-blue-50/50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => navigate(evt.actionLink)}>
                                    <div className="flex items-center gap-4">
                                        {/* Icona differenziata */}
                                        <div className={`p-2 rounded-full ${
                                            evt.type === 'checkin' ? 'bg-green-100 text-green-600' :
                                            evt.type === 'checkout' ? 'bg-orange-100 text-orange-600' :
                                            evt.type === 'payment' ? 'bg-blue-100 text-blue-600' :
                                            'bg-purple-100 text-purple-600'
                                        }`}>
                                            {evt.type === 'checkin' && <User className="w-5 h-5" />}
                                            {evt.type === 'checkout' && <LogOutIcon className="w-5 h-5" />}
                                            {evt.type === 'payment' && <EuroIcon className="w-5 h-5" />}
                                            {evt.type === 'maintenance' && <ClipboardList className="w-5 h-5" />}
                                        </div>
                                        
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{evt.title}</h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {evt.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" className="text-blue-600">Vedi <ArrowRight className="ml-1 w-4 h-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                <CalendarIcon className="w-8 h-8 opacity-20" />
                            </div>
                            <p>Nessun impegno per questa data.</p>
                            <Button variant="link" onClick={() => setSelectedDate(new Date())} className="mt-2 text-blue-600">
                                Torna a Oggi
                            </Button>
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>
      </div>
    </div>
  );
}

// Icone Helper locali per evitare import non necessari se non usati altrove
function LogOutIcon(props: any) { return <TrendingUp className={`rotate-180 ${props.className}`} /> }
function EuroIcon(props: any) { return <span className={`font-bold text-lg leading-none ${props.className}`}>€</span> }