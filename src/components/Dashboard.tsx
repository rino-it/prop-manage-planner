import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, 
  Calendar as CalendarIcon, ArrowRight, MapPin, User, Wrench, 
  Wallet, LogOut, Bell, Truck, Circle, ExternalLink, ClipboardList
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, subMonths, addMonths, isSameMonth } from 'date-fns';
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
  
  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString();
  const rangeEnd = addMonths(endOfMonth(new Date()), 2).toISOString();

  // --- FETCH DATI (MANTENUTO ORIGINALE) ---
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

  // --- MOTORE EVENTI (MANTENUTO ORIGINALE) ---
  const dashboardData = useMemo(() => {
    if (!rawData) return { events: [], kpi: { incassato: 0, atteso: 0, uscite: 0 }, urgencies: [] };

    const events: DashboardEvent[] = [];
    const isPast = (date: Date) => isBefore(date, new Date());

    // A. Booking
    rawData.bookings.forEach(b => {
      const inDate = new Date(b.data_inizio);
      const outDate = new Date(b.data_fine);
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
        id: `exp-${exp.id}`, date: new Date(exp.scadenza), type: 'expense',
        title: `Uscita: €${exp.importo}`, subtitle: `${target} - ${exp.categoria}`,
        amount: Number(exp.importo), priority: 'media', status: exp.stato, targetTab: 'expenses',
        isCompleted: exp.stato === 'pagato'
      });
    });

    // C. Incassi
    rawData.income.forEach(inc => {
      events.push({
        id: `inc-${inc.id}`, date: new Date(inc.data_scadenza), type: 'payment',
        title: `Incasso: €${inc.importo}`, subtitle: inc.description || 'Affitto',
        amount: Number(inc.importo), priority: 'media', status: inc.stato, targetTab: 'revenue',
        isCompleted: inc.stato === 'pagato'
      });
    });

    // D. Ticket
    rawData.tickets.forEach(t => {
      // Usa scadenza se c'è, altrimenti created_at
      const ticketDate = t.scadenza ? new Date(t.scadenza) : new Date(t.created_at);
      
      events.push({
        id: `tick-${t.id}`, date: ticketDate, type: 'maintenance',
        title: `Ticket: ${t.titolo}`, subtitle: t.properties_real?.nome || 'Generale',
        priority: t.priorita === 'alta' ? 'alta' : 'media', status: t.stato, targetTab: 'tickets', 
        isCompleted: t.stato === 'risolto'
      });
    });

    // E. Veicoli
    rawData.vehicles.forEach(v => {
      if (v.data_revisione) events.push({
        id: `rev-${v.id}`, date: new Date(v.data_revisione), type: 'deadline',
        title: 'Scadenza Revisione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties',
        isCompleted: isPast(new Date(v.data_revisione))
      });
      if (v.scadenza_assicurazione) events.push({
        id: `ass-${v.id}`, date: new Date(v.scadenza_assicurazione), type: 'deadline',
        title: 'Scadenza Assicurazione', subtitle: `${v.veicolo} (${v.targa})`,
        priority: 'alta', status: 'pending', targetTab: 'mobile-properties',
        isCompleted: isPast(new Date(v.scadenza_assicurazione))
      });
    });

    // F. Attività
    rawData.activities.forEach(a => {
        const target = a.properties_mobile ? `🚛 ${a.properties_mobile.veicolo}` : (a.properties_real?.nome ? `🏠 ${a.properties_real.nome}` : 'Generale');
        const actDate = new Date(a.data || a.created_at);
        events.push({
            id: `act-${a.id}`, date: actDate, type: 'activity',
            title: a.titolo || 'Attività', subtitle: `${target} - ${a.descrizione || ''}`,
            priority: 'media', status: a.stato, targetTab: 'activities',
            isCompleted: a.stato === 'completato' || a.stato === 'svolto'
        });
    });

    // KPI
    const kpi = {
      incassato: rawData.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0),
      atteso: rawData.income.filter(i => i.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0),
      uscite: rawData.expenses.reduce((acc, c) => acc + Number(c.importo), 0)
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

  const monthlyEvents = dashboardData.events
    .filter(e => selectedDate && isSameMonth(e.date, selectedDate))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200 cursor-pointer hover:bg-green-100" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-4 md:p-6 flex justify-between items-center">
            <div><p className="text-xs font-bold text-green-700 uppercase">Incassato (Mese)</p><h2 className="text-xl md:text-2xl font-bold text-green-900">€ {dashboardData.kpi.incassato.toLocaleString()}</h2></div>
            <TrendingUp className="text-green-600 w-6 h-6 md:w-8 md:h-8" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-4 md:p-6 flex justify-between items-center">
            <div><p className="text-xs font-bold text-blue-700 uppercase">Da Incassare</p><h2 className="text-xl md:text-2xl font-bold text-blue-900">€ {dashboardData.kpi.atteso.toLocaleString()}</h2></div>
            <Clock className="text-blue-600 w-6 h-6 md:w-8 md:h-8" />
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 cursor-pointer hover:bg-red-100" onClick={() => onNavigate('expenses')}>
          <CardContent className="p-4 md:p-6 flex justify-between items-center">
            <div><p className="text-xs font-bold text-red-700 uppercase">Uscite (Mese)</p><h2 className="text-xl md:text-2xl font-bold text-red-900">€ {dashboardData.kpi.uscite.toLocaleString()}</h2></div>
            <TrendingDown className="text-red-600 w-6 h-6 md:w-8 md:h-8" />
          </CardContent>
        </Card>
      </div>

      {/* ALERT URGENZE */}
      {dashboardData.urgencies.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold ml-2 flex justify-between items-center text-sm md:text-base">
             <span>Attenzione: {dashboardData.urgencies.length} attività critiche</span>
             <Button variant="link" className="text-red-900 underline h-auto p-0 text-xs md:text-sm" onClick={() => setIsUrgencyOpen(true)}>
                Vedi elenco
             </Button>
          </AlertTitle>
        </Alert>
      )}

      {/* LAYOUT AGENDA E CALENDARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[600px] h-auto">
        
        {/* SX: AGENDA GIORNALIERA */}
        <Card className="flex flex-col shadow-md border-l-4 border-l-blue-500 h-[500px] lg:h-full">
            <CardHeader className="bg-slate-50 border-b py-4">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/>
                    Agenda del Giorno
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-500 font-medium">
                    {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: it }) : 'Seleziona una data'}
                </p>
            </CardHeader>
            <ScrollArea className="flex-1 p-0">
                {dailyEvents.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {dailyEvents.map((evt) => (
                            <div key={evt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 group cursor-pointer" onClick={() => onNavigate(evt.targetTab)}>
                                <div className={`mt-1 p-2 rounded-full shrink-0 ${evt.isCompleted ? 'bg-slate-100 opacity-50' : 'bg-blue-50 text-blue-700'}`}>
                                    {getIcon(evt.type)}
                                </div>
                                <div className={`flex-1 min-w-0 ${evt.isCompleted ? 'opacity-60 grayscale' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-sm font-bold truncate pr-2 ${evt.isCompleted ? 'line-through text-slate-500' : 'text-gray-900'}`}>{evt.title}</h4>
                                        {evt.amount && <span className={`text-xs font-mono font-bold whitespace-nowrap ${evt.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>{evt.type === 'expense' ? '-' : '+'}€{evt.amount}</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 truncate"><MapPin className="w-3 h-3 inline mr-1"/>{evt.subtitle}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 self-center hidden sm:block" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <CheckCircle className="w-12 h-12 mb-3 opacity-10" />
                        <p className="text-sm">Nessuna attività.</p>
                        <Button variant="link" onClick={() => setSelectedDate(new Date())}>Vai a Oggi</Button>
                    </div>
                )}
            </ScrollArea>
        </Card>

        {/* DX: CALENDARIO E RIEPILOGO MESE */}
        <Card className="flex flex-col shadow-md h-auto lg:h-full">
            <div className="p-2 md:p-4 flex justify-center bg-white border-b">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={it}
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                    className="rounded-md border shadow-sm w-full max-w-[350px]" 
                />
            </div>
            
            <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-slate-500">Mese</span>
                <Badge variant="outline" className="bg-white">{monthlyEvents.length} Eventi</Badge>
            </div>

            <ScrollArea className="flex-1 h-[250px] lg:h-auto"> 
                <div className="divide-y">
                    {monthlyEvents.map(evt => (
                        <div key={evt.id} className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer group" onClick={() => onNavigate(evt.targetTab)}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                {evt.isCompleted ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0"/> : <Circle className="w-4 h-4 text-slate-300 shrink-0"/>}
                                <div className="min-w-0">
                                    <p className={`text-sm font-medium truncate ${evt.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        <span className="font-mono text-xs text-slate-400 mr-2">{format(evt.date, 'dd/MM')}</span>
                                        {evt.title}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {monthlyEvents.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Nessun dato.</p>}
                </div>
            </ScrollArea>
        </Card>
      </div>

      {/* DIALOG "TUTTE LE URGENZE" */}
      <Dialog open={isUrgencyOpen} onOpenChange={setIsUrgencyOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5"/> Centro Notifiche ({dashboardData.urgencies.length})
                </DialogTitle>
                <DialogDescription>Attività scadute o ad alta priorità.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-2">
                <div className="space-y-2 mt-2">
                    {dashboardData.urgencies.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 md:p-4 border rounded-lg bg-red-50/50 hover:bg-red-50 cursor-pointer transition-colors" onClick={() => { setIsUrgencyOpen(false); onNavigate(u.targetTab); }}>
                            <div className="flex gap-3 items-start overflow-hidden">
                                <div className="mt-1 bg-white p-1.5 rounded border shadow-sm text-red-600 shrink-0">{getIcon(u.type)}</div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900 text-sm truncate">{u.title}</h4>
                                    <p className="text-xs text-gray-600 truncate">{u.subtitle}</p>
                                    <p className="text-xs text-red-500 font-medium mt-1">Scadenza: {format(u.date, 'dd MMM yyyy')}</p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="shrink-0"><ArrowRight className="w-4 h-4"/></Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
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