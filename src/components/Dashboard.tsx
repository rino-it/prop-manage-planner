import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, 
  Calendar as CalendarIcon, ArrowRight, MapPin, User, Wrench, 
  Wallet, LogOut, Bell, Truck, Circle, Filter, LayoutGrid, List, 
  ExternalLink, ClipboardList 
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, subMonths, addMonths, isSameMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

type EventType = 'checkin' | 'checkout' | 'payment' | 'expense' | 'maintenance' | 'deadline' | 'activity';

interface DashboardEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  subtitle: string;
  amount?: number;
  priority: 'alta' | 'media' | 'bassa';
  status: string;
  targetTab: string;
  isCompleted: boolean;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isUrgencyOpen, setIsUrgencyOpen] = useState(false); 
  const [isAgendaOpen, setIsAgendaOpen] = useState(false); 
  const [agendaFilter, setAgendaFilter] = useState('all'); 
  
  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString();
  const rangeEnd = addMonths(endOfMonth(new Date()), 2).toISOString();

  // --- FETCH DATI ---
  const { data: rawData } = useQuery({
    queryKey: ['dashboard-full-data'],
    queryFn: async () => {
      const [bookings, expenses, income, tickets, vehicles, activities] = await Promise.all([
        supabase.from('bookings').select('id, data_inizio, data_fine, nome_ospite, properties_real(nome)')
          .or(`data_inizio.gte.${rangeStart},data_fine.lte.${rangeEnd}`),
        supabase.from('payments').select('*, properties_real(nome), properties_mobile(veicolo, targa)')
          .gte('scadenza', rangeStart).lte('scadenza', rangeEnd),
        supabase.from('tenant_payments').select('*')
          .gte('data_scadenza', rangeStart).lte('data_scadenza', rangeEnd),
        supabase.from('tickets').select('*, properties_real(nome)')
          .neq('stato', 'risolto'),
        supabase.from('properties_mobile').select('*').eq('status', 'active'),
        supabase.from('activities').select('*, properties_real(nome), properties_mobile(veicolo, targa)')
          .gte('data', rangeStart).lte('data', rangeEnd)
      ]);

      return {
        bookings: bookings.data || [],
        expenses: expenses.data || [],
        income: income.data || [],
        tickets: tickets.data || [],
        vehicles: vehicles.data || [],
        activities: activities.data || []
      };
    }
  });

  // --- MOTORE EVENTI ---
  const dashboardData = useMemo(() => {
    if (!rawData) return { events: [], kpi: { incassato: 0, atteso: 0, uscite: 0 }, urgencies: [] };

    const events: DashboardEvent[] = [];
    const isPast = (date: Date) => isBefore(date, new Date());

    // A. Booking
    rawData.bookings.forEach(b => {
      // FIX: parseISO
      const inDate = parseISO(b.data_inizio);
      const outDate = parseISO(b.data_fine);
      events.push({
        id: `in-${b.id}`, date: inDate, type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(inDate)
      });
      events.push({
        id: `out-${b.id}`, date: outDate, type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprietà',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(outDate)
      });
    });

    // B. Spese
    rawData.expenses.forEach(exp => {
      const target = exp.properties_mobile ? `🚛 ${exp.properties_mobile.veicolo}` : `🏠 ${exp.properties_real?.nome || 'Generale'}`;
      events.push({
        // FIX: parseISO
        id: `exp-${exp.id}`, date: parseISO(exp.scadenza), type: 'expense',
        title: `Uscita: €${exp.importo}`, subtitle: `${target} - ${exp.categoria}`,
        amount: Number(exp.importo), priority: 'media', status: exp.stato, targetTab: 'expenses',
        isCompleted: exp.stato === 'pagato'
      });
    });

    // C. Incassi
    rawData.income.forEach(inc => {
      events.push({
        // FIX: parseISO
        id: `inc-${inc.id}`, date: parseISO(inc.data_scadenza), type: 'payment',
        title: `Incasso: €${inc.importo}`, subtitle: inc.description || 'Affitto',
        amount: Number(inc.importo), priority: 'media', status: inc.stato, targetTab: 'revenue',
        isCompleted: inc.stato === 'pagato'
      });
    });

    // D. Ticket
    rawData.tickets.forEach(t => {
      // FIX: parseISO
      const ticketDate = t.scadenza ? parseISO(t.scadenza) : parseISO(t.created_at);
      events.push({
        id: `tick-${t.id}`, date: ticketDate, type: 'maintenance',
        title: `Ticket: ${t.titolo}`, subtitle: t.properties_real?.nome || 'Generale',
        priority: t.priorita === 'alta' ? 'alta' : 'media', status: t.stato, targetTab: 'tickets', 
        isCompleted: t.stato === 'risolto'
      });
    });

    // E. Veicoli
    rawData.vehicles.forEach(v => {
      // FIX: parseISO
      if (v.data_revisione) events.push({
        id: `rev-${v.id}`, date: parseISO(v.data_revisione), type: 'deadline',
        title: 'Scadenza Revisione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties',
        isCompleted: isPast(parseISO(v.data_revisione))
      });
      if (v.scadenza_assicurazione) events.push({
        id: `ass-${v.id}`, date: parseISO(v.scadenza_assicurazione), type: 'deadline',
        title: 'Scadenza Assicurazione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties',
        isCompleted: isPast(parseISO(v.scadenza_assicurazione))
      });
    });

    // F. Attività
    rawData.activities.forEach(a => {
        const target = a.properties_mobile ? `🚛 ${a.properties_mobile.veicolo}` : (a.properties_real?.nome ? `🏠 ${a.properties_real.nome}` : 'Generale');
        // FIX: parseISO
        const actDate = parseISO(a.data || a.created_at);
        events.push({
            id: `act-${a.id}`, date: actDate, type: 'activity',
            title: a.titolo || 'Attività', subtitle: `${target} - ${a.descrizione || ''}`,
            priority: 'media', status: a.stato, targetTab: 'activities',
            isCompleted: a.stato === 'completato' || a.stato === 'svolto'
        });
    });

    // --- FIX KPI (Calcolo preciso per il mese corrente con parseISO) ---
    const now = new Date();
    const currentMonthIncome = rawData.income.filter(i => isSameMonth(parseISO(i.data_scadenza), now));
    const currentMonthExpenses = rawData.expenses.filter(e => isSameMonth(parseISO(e.scadenza), now));

    const kpi = {
      incassato: currentMonthIncome.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0),
      atteso: currentMonthIncome.filter(i => i.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0),
      uscite: currentMonthExpenses.reduce((acc, c) => acc + Number(c.importo), 0)
    };

    // Urgenze
    const urgencies = events.filter(e => 
      (e.priority === 'alta' && isBefore(e.date, new Date()) && !e.isCompleted) ||
      (e.type === 'maintenance' && !e.isCompleted) ||
      (e.type === 'payment' && !e.isCompleted && isBefore(e.date, new Date())) ||
      (e.type === 'activity' && !e.isCompleted && isBefore(e.date, new Date()))
    );

    return { events, kpi, urgencies };
  }, [rawData]);

  const dailyEvents = dashboardData.events
    .filter(e => selectedDate && isSameDay(e.date, selectedDate))
    .sort((a, b) => (a.priority === 'alta' ? -1 : 1));

  // --- FILTRO AGENDA COMPLETA ---
  const filteredAgendaEvents = useMemo(() => {
      const monthEvents = dashboardData.events.filter(e => selectedDate && isSameMonth(e.date, selectedDate));
      
      if (agendaFilter === 'all') return monthEvents;
      if (agendaFilter === 'hospitality') return monthEvents.filter(e => e.type === 'checkin' || e.type === 'checkout');
      if (agendaFilter === 'finance') return monthEvents.filter(e => e.type === 'payment' || e.type === 'expense');
      if (agendaFilter === 'maintenance') return monthEvents.filter(e => e.type === 'maintenance' || e.type === 'deadline');
      if (agendaFilter === 'activity') return monthEvents.filter(e => e.type === 'activity');
      
      return monthEvents;
  }, [dashboardData.events, selectedDate, agendaFilter]);

  const modifiers = {
    hasCheckin: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'checkin' || e.type === 'payment')),
    hasExpense: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'expense' || e.type === 'checkout')),
    hasActivity: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && e.type === 'activity'),
    hasWarning: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.type === 'deadline' || e.type === 'maintenance')),
  };
  const modifiersStyles = {
    hasCheckin: { color: '#16a34a', fontWeight: 'bold' },
    hasExpense: { color: '#dc2626', fontWeight: 'bold' },
    hasActivity: { color: '#6366f1', fontWeight: 'bold' },
    hasWarning: { textDecoration: 'underline', textDecorationColor: '#f59e0b' }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Torre di Controllo</h1>
          <p className="text-gray-500 text-sm">Panoramica operativa e finanziaria</p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{format(new Date(), 'EEEE d MMMM', { locale: it })}</p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Incassato (Mese)</p>
                <h2 className="text-2xl font-bold text-green-600">€ {dashboardData.kpi.incassato.toLocaleString()}</h2>
            </div>
            <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Previsione</p>
                <h2 className="text-2xl font-bold text-blue-600">€ {dashboardData.kpi.atteso.toLocaleString()}</h2>
            </div>
            <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Uscite (Mese)</p>
                <h2 className="text-2xl font-bold text-red-600">€ {dashboardData.kpi.uscite.toLocaleString()}</h2>
            </div>
            <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                <TrendingDown className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRIGLIA PRINCIPALE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNA SX: CALENDARIO E EVENTI GIORNO */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm border-slate-200">
                <div className="p-4 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={it}
                        modifiers={modifiers}
                        modifiersStyles={modifiersStyles}
                        className="rounded-md border shadow-sm w-full max-w-[320px]" 
                    />
                </div>
            </Card>
            
            <Card className="shadow-sm border-l-4 border-l-blue-600 h-[300px] flex flex-col">
                <CardHeader className="py-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-600"/> {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Oggi'}
                    </CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                    {dailyEvents.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {dailyEvents.map((evt) => (
                                <div key={evt.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer" onClick={() => onNavigate(evt.targetTab)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${evt.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                            {getIcon(evt.type)}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold ${evt.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>{evt.title}</p>
                                            <p className="text-[10px] text-slate-500">{evt.subtitle}</p>
                                        </div>
                                    </div>
                                    {evt.amount && <span className={`text-xs font-bold ${evt.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>€{evt.amount}</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300">
                            <CheckCircle className="w-8 h-8 mb-2 opacity-20"/>
                            <p className="text-xs">Nessun evento oggi.</p>
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>

        {/* COLONNA DX: CENTRO NOTIFICHE E AGENDA COMPLETA */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* CARD 1: URGENZE (CENTRO NOTIFICHE) */}
            <Card className="shadow-md border-t-4 border-t-red-500 bg-white">
                <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-2 rounded-full text-red-600"><AlertTriangle className="w-5 h-5"/></div>
                        <div>
                            <CardTitle className="text-lg">Centro Notifiche</CardTitle>
                            <CardDescription className="text-xs">{dashboardData.urgencies.length} attività richiedono attenzione</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsUrgencyOpen(true)} className="text-xs">
                        Vedi Tutte ({dashboardData.urgencies.length})
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {dashboardData.urgencies.slice(0, 3).map((u) => (
                            <div key={u.id} className="p-4 flex items-center justify-between hover:bg-red-50/30 transition-colors cursor-pointer" onClick={() => onNavigate(u.targetTab)}>
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 text-red-500">{getIcon(u.type)}</div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800">{u.title}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3"/> Scadenza: {format(u.date, 'dd MMM yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300"/>
                            </div>
                        ))}
                        {dashboardData.urgencies.length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-sm">Nessuna urgenza attiva. Ottimo lavoro! 🚀</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* CARD 2: AGENDA MENSILE (SECONDO LIVELLO) */}
            <Card className="shadow-md border-t-4 border-t-indigo-500 bg-white">
                <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><LayoutGrid className="w-5 h-5"/></div>
                        <div>
                            <CardTitle className="text-lg">Panoramica {selectedDate ? format(selectedDate, 'MMMM') : 'Mese'}</CardTitle>
                            <CardDescription className="text-xs">Prossimi eventi in programma</CardDescription>
                        </div>
                    </div>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-xs" size="sm" onClick={() => setIsAgendaOpen(true)}>
                        <List className="w-3 h-3 mr-2"/> Apri Agenda Completa
                    </Button>
                </CardHeader>
                <CardContent className="p-4">
                    {/* Anteprima Prossimi 3 Eventi */}
                    <div className="space-y-2">
                        {dashboardData.events
                            .filter(e => isBefore(new Date(), e.date) && !e.isCompleted) // Solo futuri
                            .slice(0, 3)
                            .map((e) => (
                                <div key={e.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                                    <div className="bg-white p-1 rounded text-slate-500 shadow-sm text-xs font-bold w-10 text-center">
                                        {format(e.date, 'dd')}
                                        <span className="block text-[8px] uppercase">{format(e.date, 'MMM')}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{e.title}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{e.subtitle}</p>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] bg-white border-slate-200 text-slate-600">{e.type}</Badge>
                                </div>
                            ))
                        }
                        {dashboardData.events.filter(e => isBefore(new Date(), e.date) && !e.isCompleted).length === 0 && (
                            <p className="text-center text-xs text-slate-400">Nessun evento futuro imminente.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

        </div>
      </div>

      {/* --- SHEET 1: CENTRO NOTIFICHE (SIDEBAR DESTRA) --- */}
      <Sheet open={isUrgencyOpen} onOpenChange={setIsUrgencyOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5"/> Centro Notifiche
                </SheetTitle>
                <SheetDescription>Tutte le attività scadute o con priorità alta.</SheetDescription>
            </SheetHeader>
            <div className="space-y-3">
                {dashboardData.urgencies.map((u) => (
                    <div key={u.id} className="p-3 bg-red-50 border border-red-100 rounded-lg cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate(u.targetTab)}>
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-sm text-red-900">{u.title}</h4>
                            <Badge variant="destructive" className="text-[10px]">URGENTE</Badge>
                        </div>
                        <p className="text-xs text-red-700 mb-2">{u.subtitle}</p>
                        <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
                            <Clock className="w-3 h-3"/> Scadenza: {format(u.date, 'dd MMMM yyyy')}
                        </div>
                    </div>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      {/* --- DIALOG 2: AGENDA COMPLETA (SECONDO LIVELLO) --- */}
      <Dialog open={isAgendaOpen} onOpenChange={setIsAgendaOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-600"/> Agenda Mensile: {selectedDate ? format(selectedDate, 'MMMM yyyy') : ''}
                </DialogTitle>
                <DialogDescription>Gestione completa degli eventi del mese.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden" onValueChange={setAgendaFilter}>
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-slate-100 p-1">
                    <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
                    <TabsTrigger value="hospitality" className="text-xs">🏠 Ospitalità</TabsTrigger>
                    <TabsTrigger value="finance" className="text-xs">💶 Finanze</TabsTrigger>
                    <TabsTrigger value="maintenance" className="text-xs">🔧 Manutenzione</TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs">📝 Attività</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1 mt-2 pr-2 border rounded-md bg-slate-50/30 p-2">
                    <div className="space-y-1">
                        {filteredAgendaEvents.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <Filter className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                                <p>Nessun evento trovato per questo filtro.</p>
                            </div>
                        ) : (
                            filteredAgendaEvents.map((evt) => (
                                <div key={evt.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all cursor-pointer group" onClick={() => onNavigate(evt.targetTab)}>
                                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg font-bold ${evt.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                        <span className="text-lg leading-none">{format(evt.date, 'dd')}</span>
                                        <span className="text-[9px] uppercase leading-none">{format(evt.date, 'MMM')}</span>
                                    </div>
                                    
                                    <div className={`flex-1 ${evt.isCompleted ? 'opacity-50' : ''}`}>
                                        <div className="flex justify-between">
                                            <h4 className="font-semibold text-sm text-slate-800">{evt.title}</h4>
                                            {evt.amount && <span className={`text-xs font-mono font-bold ${evt.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>€{evt.amount}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-[9px] bg-slate-50">{evt.type}</Badge>
                                            <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                                                <MapPin className="w-3 h-3"/> {evt.subtitle}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-slate-300 group-hover:text-blue-500">
                                        <ExternalLink className="w-4 h-4"/>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </Tabs>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function getIcon(type: EventType) {
    switch (type) {
        case 'checkin': return <User className="w-5 h-5" />;
        case 'checkout': return <LogOut className="w-5 h-5" />;
        case 'payment': return <Wallet className="w-5 h-5" />;
        case 'expense': return <TrendingDown className="w-5 h-5" />;
        case 'maintenance': return <Wrench className="w-5 h-5" />;
        case 'deadline': return <Truck className="w-5 h-5" />;
        case 'activity': return <ClipboardList className="w-5 h-5" />;
        default: return <Bell className="w-5 h-5" />;
    }
}