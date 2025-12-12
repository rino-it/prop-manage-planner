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
  Wallet,
  LogOut,
  Bell
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

// Tipi estesi per includere anche le spese e i ticket nel calendario
type DashboardEvent = {
  id: string;
  date: Date;
  type: 'checkin' | 'checkout' | 'payment' | 'expense' | 'maintenance';
  title: string;
  subtitle: string;
  amount?: number; // Opzionale, per mostrare cifre
  priority: 'alta' | 'media' | 'bassa';
  status: string;
  targetTab: string;
};

export default function Dashboard({ onNavigate }: DashboardProps) {
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

  // 2. QUERY FINANZE (Entrate e Uscite)
  const { data: finances } = useQuery({
    queryKey: ['dashboard-finances'],
    queryFn: async () => {
      // Entrate
      const { data: income } = await supabase
        .from('tenant_payments')
        .select('*')
        .gte('data_scadenza', startMonth)
        .lte('data_scadenza', endMonth);

      // Uscite (Spese)
      const { data: expenses } = await supabase
        .from('property_expenses')
        .select('*, properties_real(nome)') // Prendiamo anche il nome casa
        .gte('date', startMonth)
        .lte('date', endMonth);

      // Scaduti (Urgenze)
      const { data: overdue } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('stato', 'da_pagare')
        .lt('data_scadenza', new Date().toISOString());

      return { income: income || [], expenses: expenses || [], overdue: overdue || [] };
    }
  });

  // 3. QUERY TICKET (Manutenzioni)
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

  // --- IL CERVELLO: UNIFICAZIONE EVENTI ---
  const dashboardData = useMemo(() => {
    const events: DashboardEvent[] = [];
    
    // A. Logistica (Check-in / Check-out)
    bookings?.forEach(b => {
      // Check-in
      events.push({
        id: `in-${b.id}`,
        date: new Date(b.data_inizio),
        type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`,
        subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta',
        status: 'pending',
        targetTab: 'bookings'
      });
      // Check-out
      events.push({
        id: `out-${b.id}`,
        date: new Date(b.data_fine),
        type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`,
        subtitle: b.properties_real?.nome || 'Proprietà sconosciuta',
        priority: 'alta',
        status: 'pending',
        targetTab: 'bookings'
      });
    });

    // B. Entrate (Scadenze pagamenti inquilini)
    finances?.income.forEach(inc => {
      events.push({
        id: `pay-${inc.id}`,
        date: new Date(inc.data_scadenza),
        type: 'payment',
        title: `Incasso atteso: €${inc.importo}`,
        subtitle: inc.description || 'Rata affitto',
        amount: Number(inc.importo),
        priority: 'media',
        status: inc.stato || 'da_pagare',
        targetTab: 'revenue'
      });
    });

    // C. Uscite (Spese registrate) - NUOVO!
    finances?.expenses.forEach(exp => {
        events.push({
          id: `exp-${exp.id}`,
          date: new Date(exp.date),
          type: 'expense',
          title: `Uscita: €${exp.amount}`,
          subtitle: `${exp.properties_real?.nome || 'Generale'} - ${exp.category}`,
          amount: Number(exp.amount),
          priority: 'media',
          status: 'paid',
          targetTab: 'expenses'
        });
    });

    // D. Ticket (Manutenzioni attive) - NUOVO!
    tickets?.forEach(t => {
        events.push({
            id: `tick-${t.id}`,
            date: new Date(t.created_at), // Usiamo la data creazione come riferimento
            type: 'maintenance',
            title: `Ticket: ${t.titolo}`,
            subtitle: t.properties_real?.nome || 'Generale',
            priority: t.priorita === 'alta' ? 'alta' : 'media',
            status: t.stato,
            targetTab: 'activities'
        });
    });

    // E. Calcolo KPI
    const kpi = {
      incassato: finances?.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      atteso: finances?.income.filter(i => i.stato === 'da_pagare' || i.stato === 'in_verifica').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      uscite: finances?.expenses.reduce((acc, c) => acc + Number(c.amount), 0) || 0
    };

    // F. Lista Urgenze (Box Rosso)
    const urgencies = [
      ...(tickets?.filter(t => t.priorita === 'alta' || t.priorita === 'critica').map(t => ({
        type: 'ticket', text: `GUASTO CRITICO: ${t.titolo} (${t.properties_real?.nome})`, id: t.id, targetTab: 'activities'
      })) || []),
      ...(finances?.overdue.map(o => ({
        type: 'payment', text: `SCADUTO: €${o.importo} - ${o.description}`, id: o.id, targetTab: 'revenue'
      })) || [])
    ];

    return { events, kpi, urgencies };
  }, [bookings, finances, tickets]);

  // Filtra eventi per il giorno selezionato
  const dailyEvents = dashboardData.events.filter(e => 
    selectedDate && isSameDay(e.date, selectedDate)
  );

  // Modifiers per i pallini colorati nel calendario
  const modifiers = {
    hasEvent: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date)),
    hasCheckin: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && e.type === 'checkin'),
    hasExpense: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && e.type === 'expense'),
    hasUrgency: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && (e.priority === 'alta' || e.type === 'maintenance')),
  };

const modifiersStyles = {
    hasEvent: { 
      textDecoration: 'underline', 
      textDecorationColor: 'rgba(255, 255, 255, 0.5)', // Subtle white line
      textUnderlineOffset: '2px' // Clean separation from text
    },
    
    // Emerald-300: A bright mint green. 
    // Distinct from blue, but positive.
    hasCheckin: { 
      color: '#6ee7b7', 
      fontWeight: '700' 
    }, 

    // Rose-300: A soft pastel red/pink. 
    // Retains the "expense/negative" meaning without vibrating against blue.
    hasExpense: { 
      color: '#fda4af', 
      fontWeight: '700' 
    }, 

    // Amber-300: A bright gold/yellow ring.
    // Yellow creates the highest contrast possible against blue for alerts.
    hasUrgency: { 
      border: '2px solid #fcd34d', 
      borderRadius: '50%' 
    } 
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
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

      {/* KPI CLICCABILI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200 shadow-sm cursor-pointer hover:bg-green-100 transition-colors" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm font-medium text-green-700 uppercase tracking-wider">Incassato</p><h2 className="text-3xl font-bold text-green-900 mt-1">€ {dashboardData.kpi.incassato.toLocaleString()}</h2></div>
            <div className="p-3 bg-green-100 rounded-full text-green-700"><CheckCircle className="w-6 h-6" /></div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-200 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm font-medium text-blue-700 uppercase tracking-wider">In Attesa</p><h2 className="text-3xl font-bold text-blue-900 mt-1">€ {dashboardData.kpi.atteso.toLocaleString()}</h2></div>
            <div className="p-3 bg-blue-100 rounded-full text-blue-700"><Clock className="w-6 h-6" /></div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200 shadow-sm cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onNavigate('expenses')}>
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm font-medium text-red-700 uppercase tracking-wider">Uscite</p><h2 className="text-3xl font-bold text-red-900 mt-1">€ {dashboardData.kpi.uscite.toLocaleString()}</h2></div>
            <div className="p-3 bg-red-100 rounded-full text-red-700"><TrendingDown className="w-6 h-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* URGENZE */}
      {dashboardData.urgencies.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 shadow-sm">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold text-lg ml-2">Attenzione Richiesta ({dashboardData.urgencies.length})</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc list-inside space-y-1 ml-1">
              {dashboardData.urgencies.map((u, idx) => (
                <li key={idx} className="flex items-center justify-between hover:bg-red-100 p-1 rounded cursor-pointer" onClick={() => onNavigate(u.targetTab)}>
                  <span className="text-sm font-medium">{u.text}</span>
                  <ArrowRight className="w-4 h-4 opacity-50" />
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* SEZIONE CALENDARIO E AGENDA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* CALENDARIO */}
        <Card className="lg:col-span-1 shadow-md border-slate-200">
            <CardHeader><CardTitle>Calendario Attività</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={it}
                    className="rounded-md border"
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                />
                <div className="mt-4 flex flex-wrap gap-2 justify-center text-[10px] text-gray-500">
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Check-in</span>
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Uscita/Spesa</span>
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full border border-red-500 mr-1"></span> Urgenza</span>
                </div>
            </CardContent>
        </Card>

        {/* AGENDA DETTAGLIATA */}
        <Card className="lg:col-span-2 shadow-md border-slate-200 flex flex-col min-h-[400px]">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-blue-600"/>
                        Agenda del {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Giorno'}
                    </CardTitle>
                    <Badge variant="secondary" className="text-sm">{dailyEvents.length} Attività</Badge>
                </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-0 h-[400px]">
                {dailyEvents.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {dailyEvents.map((evt) => (
                            <div key={evt.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 group cursor-pointer" onClick={() => onNavigate(evt.targetTab)}>
                                {/* ICONA TIPO EVENTO */}
                                <div className={`mt-1 p-2 rounded-full ${
                                    evt.type === 'checkin' ? 'bg-green-100 text-green-700' :
                                    evt.type === 'checkout' ? 'bg-orange-100 text-orange-700' :
                                    evt.type === 'payment' ? 'bg-blue-100 text-blue-700' :
                                    evt.type === 'expense' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700' // Maintenance
                                }`}>
                                    {evt.type === 'checkin' && <User className="w-5 h-5" />}
                                    {evt.type === 'checkout' && <LogOut className="w-5 h-5" />}
                                    {evt.type === 'payment' && <Wallet className="w-5 h-5" />}
                                    {evt.type === 'expense' && <TrendingDown className="w-5 h-5" />}
                                    {evt.type === 'maintenance' && <Wrench className="w-5 h-5" />}
                                </div>

                                {/* CONTENUTO */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-bold text-gray-900">{evt.title}</h4>
                                        {evt.amount && (
                                            <span className={`text-xs font-bold ${evt.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                                {evt.type === 'expense' ? '-' : '+'}€{evt.amount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center mt-1">
                                        <MapPin className="w-3 h-3 mr-1" /> {evt.subtitle}
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <Badge variant="outline" className="text-[10px] uppercase">{evt.type}</Badge>
                                        {evt.priority === 'alta' && <Badge variant="destructive" className="text-[10px]">Alta Priorità</Badge>}
                                    </div>
                                </div>

                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 self-center" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                        <Bell className="w-12 h-12 mb-3 opacity-20" />
                        <p>Nessuna notifica per questa data.</p>
                        <Button variant="link" onClick={() => setSelectedDate(new Date())}>Torna a Oggi</Button>
                    </div>
                )}
            </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
