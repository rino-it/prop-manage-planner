import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, 
  Calendar as CalendarIcon, ArrowRight, MapPin, User, Wrench, 
  Wallet, LogOut, Bell, Truck 
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, subMonths, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

// TIPI UNIFICATI
type EventType = 'checkin' | 'checkout' | 'payment' | 'expense' | 'maintenance' | 'deadline';

interface DashboardEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  subtitle: string;
  amount?: number;
  priority: 'alta' | 'media' | 'bassa';
  status: string;
  targetTab: string; // Usiamo questo per onNavigate
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Range temporale ottimizzato (Mese corrente +/- 1 mese per coprire il calendario)
  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString();
  const rangeEnd = addMonths(endOfMonth(new Date()), 2).toISOString();

  // --- 1. FETCH DATI PARALLELO (Molto più veloce di 4 query separate) ---
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['dashboard-full-data'],
    queryFn: async () => {
      const [bookings, expenses, income, tickets, vehicles] = await Promise.all([
        // A. Prenotazioni
        supabase.from('bookings').select('id, data_inizio, data_fine, nome_ospite, properties_real(nome)')
          .or(`data_inizio.gte.${rangeStart},data_fine.lte.${rangeEnd}`),
        
        // B. Spese (Tabella Unificata 'payments')
        supabase.from('payments').select('*, properties_real(nome), properties_mobile(veicolo, targa)')
          .gte('scadenza', rangeStart).lte('scadenza', rangeEnd),

        // C. Incassi (Tenant Payments)
        supabase.from('tenant_payments').select('*')
          .gte('data_scadenza', rangeStart).lte('data_scadenza', rangeEnd),

        // D. Ticket Aperti
        supabase.from('tickets').select('*, properties_real(nome)')
          .neq('stato', 'risolto'),

        // E. Scadenze Veicoli (Tutti i veicoli attivi)
        supabase.from('properties_mobile').select('*').eq('status', 'active')
      ]);

      return {
        bookings: bookings.data || [],
        expenses: expenses.data || [],
        income: income.data || [],
        tickets: tickets.data || [],
        vehicles: vehicles.data || []
      };
    }
  });

  // --- 2. MOTORE DI NORMALIZZAZIONE EVENTI ---
  const dashboardData = useMemo(() => {
    if (!rawData) return { events: [], kpi: { incassato: 0, atteso: 0, uscite: 0 }, urgencies: [] };

    const events: DashboardEvent[] = [];
    const today = new Date();

    // A. Booking (Check-in / Check-out)
    rawData.bookings.forEach(b => {
      events.push({
        id: `in-${b.id}`, date: new Date(b.data_inizio), type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà',
        priority: 'alta', status: 'pending', targetTab: 'bookings'
      });
      events.push({
        id: `out-${b.id}`, date: new Date(b.data_fine), type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà',
        priority: 'alta', status: 'pending', targetTab: 'bookings'
      });
    });

    // B. Spese (Uscite)
    rawData.expenses.forEach(exp => {
      // Determina il target (Casa o Veicolo) per mostrarlo bene
      const target = exp.properties_mobile 
        ? `🚛 ${exp.properties_mobile.veicolo}` 
        : `🏠 ${exp.properties_real?.nome || 'Generale'}`;
        
      events.push({
        id: `exp-${exp.id}`, date: new Date(exp.scadenza), type: 'expense',
        title: `Uscita: €${exp.importo}`, subtitle: `${target} - ${exp.categoria}`,
        amount: Number(exp.importo), priority: 'media', status: exp.stato, targetTab: 'expenses'
      });
    });

    // C. Incassi (Entrate)
    rawData.income.forEach(inc => {
      events.push({
        id: `inc-${inc.id}`, date: new Date(inc.data_scadenza), type: 'payment',
        title: `Incasso: €${inc.importo}`, subtitle: inc.description || 'Affitto',
        amount: Number(inc.importo), priority: 'media', status: inc.stato, targetTab: 'revenue'
      });
    });

    // D. Ticket
    rawData.tickets.forEach(t => {
      events.push({
        id: `tick-${t.id}`, date: new Date(t.created_at), type: 'maintenance',
        title: `Ticket: ${t.titolo}`, subtitle: t.properties_real?.nome || 'Generale',
        priority: t.priorita === 'alta' ? 'alta' : 'media', status: t.stato, targetTab: 'activities'
      });
    });

    // E. Scadenze Veicoli
    rawData.vehicles.forEach(v => {
      if (v.data_revisione) events.push({
        id: `rev-${v.id}`, date: new Date(v.data_revisione), type: 'deadline',
        title: 'Scadenza Revisione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties'
      });
      if (v.scadenza_assicurazione) events.push({
        id: `ass-${v.id}`, date: new Date(v.scadenza_assicurazione), type: 'deadline',
        title: 'Scadenza Assicurazione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties'
      });
    });

    // KPI (Totali Mese Corrente)
    const currentMonthEvents = events.filter(e => e.date.getMonth() === today.getMonth() && e.date.getFullYear() === today.getFullYear());
    const kpi = {
      incassato: rawData.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0),
      atteso: rawData.income.filter(i => i.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0),
      uscite: rawData.expenses.reduce((acc, c) => acc + Number(c.importo), 0)
    };

    // Urgenze (Scaduti o Alta Priorità Oggi/Domani)
    const urgencies = events.filter(e => 
      (e.priority === 'alta' && isBefore(e.date, new Date())) || // Scaduti alta priorità
      (e.type === 'maintenance' && e.status !== 'risolto') || // Ticket aperti
      (e.type === 'payment' && e.status === 'da_pagare' && isBefore(e.date, new Date())) // Pagamenti scaduti
    );

    return { events, kpi, urgencies };
  }, [rawData]);

  // Filtra eventi per il giorno selezionato
  const dailyEvents = dashboardData.events
    .filter(e => selectedDate && isSameDay(e.date, selectedDate))
    .sort((a, b) => {
        // Ordina: Prima Alta priorità, poi il resto
        if (a.priority === 'alta' && b.priority !== 'alta') return -1;
        return 0;
    });

  // Stili Calendario
  const modifiers = {
    hasCheckin: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'checkin' || e.type === 'payment')),
    hasExpense: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'expense' || e.type === 'checkout')),
    hasWarning: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'deadline' || e.type === 'maintenance')),
  };

  const modifiersStyles = {
    hasCheckin: { color: '#16a34a', fontWeight: 'bold' }, // Verde
    hasExpense: { color: '#dc2626', fontWeight: 'bold' }, // Rosso
    hasWarning: { textDecoration: 'underline', textDecorationColor: '#f59e0b' } // Arancio
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Torre di Controllo</h1>
          <p className="text-gray-500">Panoramica operativa e finanziaria</p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{format(new Date(), 'EEEE d MMMM', { locale: it })}</p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200 shadow-sm cursor-pointer hover:bg-green-100 transition-colors" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-xs font-bold text-green-700 uppercase tracking-wider">Incassato (Mese)</p><h2 className="text-2xl font-bold text-green-900 mt-1">€ {dashboardData.kpi.incassato.toLocaleString()}</h2></div>
            <div className="p-3 bg-green-100 rounded-full text-green-700"><TrendingUp className="w-6 h-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Da Incassare</p><h2 className="text-2xl font-bold text-blue-900 mt-1">€ {dashboardData.kpi.atteso.toLocaleString()}</h2></div>
            <div className="p-3 bg-blue-100 rounded-full text-blue-700"><Clock className="w-6 h-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 shadow-sm cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onNavigate('expenses')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-xs font-bold text-red-700 uppercase tracking-wider">Uscite (Mese)</p><h2 className="text-2xl font-bold text-red-900 mt-1">€ {dashboardData.kpi.uscite.toLocaleString()}</h2></div>
            <div className="p-3 bg-red-100 rounded-full text-red-700"><TrendingDown className="w-6 h-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* URGENZE / NOTIFICHE */}
      {dashboardData.urgencies.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold ml-2">Attenzione Richiesta ({dashboardData.urgencies.length})</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {dashboardData.urgencies.slice(0, 4).map((u, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded border border-red-100 cursor-pointer hover:bg-white" onClick={() => onNavigate(u.targetTab)}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            {u.type === 'deadline' && <Truck className="w-4 h-4 shrink-0"/>}
                            {u.type === 'maintenance' && <Wrench className="w-4 h-4 shrink-0"/>}
                            <span className="text-sm font-medium truncate">{u.title} - {u.subtitle}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50"/>
                    </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* CALENDARIO & AGENDA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* COLONNA SX: CALENDARIO */}
        <Card className="lg:col-span-1 shadow-md border-slate-200">
            <CardHeader><CardTitle>Calendario</CardTitle></CardHeader>
            <CardContent className="flex justify-center p-0 pb-4">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={it}
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                    className="rounded-md"
                />
            </CardContent>
            <div className="px-6 pb-6 text-xs text-gray-500 flex flex-wrap gap-3 justify-center border-t pt-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Entrate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Uscite</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Scadenze</span>
            </div>
        </Card>

        {/* COLONNA DX: AGENDA GIORNALIERA */}
        <Card className="lg:col-span-2 shadow-md border-slate-200 flex flex-col min-h-[400px]">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-blue-600"/>
                        Agenda del {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Giorno'}
                    </CardTitle>
                    <Badge variant="outline">{dailyEvents.length} Eventi</Badge>
                </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-0 h-[400px]">
                {dailyEvents.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {dailyEvents.map((evt) => (
                            <div key={evt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 group cursor-pointer" onClick={() => onNavigate(evt.targetTab)}>
                                {/* ICONA */}
                                <div className={`mt-1 p-2 rounded-full shrink-0 ${
                                    evt.type === 'checkin' ? 'bg-green-100 text-green-700' :
                                    evt.type === 'payment' ? 'bg-green-100 text-green-700' :
                                    evt.type === 'expense' ? 'bg-red-100 text-red-700' :
                                    evt.type === 'checkout' ? 'bg-orange-100 text-orange-700' :
                                    evt.type === 'deadline' ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {evt.type === 'checkin' && <User className="w-5 h-5" />}
                                    {evt.type === 'payment' && <Wallet className="w-5 h-5" />}
                                    {evt.type === 'expense' && <TrendingDown className="w-5 h-5" />}
                                    {evt.type === 'checkout' && <LogOut className="w-5 h-5" />}
                                    {evt.type === 'deadline' && <Truck className="w-5 h-5" />}
                                    {evt.type === 'maintenance' && <Wrench className="w-5 h-5" />}
                                </div>

                                {/* CONTENUTO */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-bold text-gray-900 truncate">{evt.title}</h4>
                                        {evt.amount && (
                                            <span className={`text-xs font-bold whitespace-nowrap ${evt.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                                {evt.type === 'expense' ? '-' : '+'}€{evt.amount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center mt-1 truncate">
                                        <MapPin className="w-3 h-3 mr-1 opacity-70" /> {evt.subtitle}
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <Badge variant="secondary" className="text-[10px] uppercase bg-slate-100 text-slate-600">{evt.type}</Badge>
                                        {evt.priority === 'alta' && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-5">Prioritario</Badge>}
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 self-center" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                        <Bell className="w-12 h-12 mb-3 opacity-20" />
                        <p>Nessun evento in agenda.</p>
                        <Button variant="link" onClick={() => setSelectedDate(new Date())} className="mt-2">Vai a Oggi</Button>
                    </div>
                )}
            </ScrollArea>
        </Card>
      </div>
    </div>
  );
}