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
  Bell,
  Truck // NUOVA ICONA PER I VEICOLI
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

type DashboardEvent = {
  id: string;
  date: Date;
  type: 'checkin' | 'checkout' | 'payment' | 'expense' | 'maintenance' | 'deadline'; // Aggiunto 'deadline'
  title: string;
  subtitle: string;
  amount?: number;
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

  // 2. QUERY FINANZE (FIX: Ora punta a 'payments' invece di 'property_expenses')
  const { data: finances } = useQuery({
    queryKey: ['dashboard-finances'],
    queryFn: async () => {
      // Entrate
      const { data: income } = await supabase
        .from('tenant_payments')
        .select('*')
        .gte('data_scadenza', startMonth)
        .lte('data_scadenza', endMonth);

      // Uscite (Spese Unificate)
      const { data: expenses } = await supabase
        .from('payments') // TABELLA CORRETTA
        .select('*, properties_real(nome), properties_mobile(veicolo, targa)') 
        .gte('scadenza', startMonth)
        .lte('scadenza', endMonth);

      // Scaduti
      const { data: overdue } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('stato', 'da_pagare')
        .lt('data_scadenza', new Date().toISOString());

      return { income: income || [], expenses: expenses || [], overdue: overdue || [] };
    }
  });

  // 3. QUERY TICKET
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

  // 4. QUERY PARCO MEZZI (NUOVA)
  const { data: fleet } = useQuery({
    queryKey: ['dashboard-fleet'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties_mobile')
        .select('*'); 
      return data || [];
    }
  });

  // --- UNIFICAZIONE EVENTI ---
  const dashboardData = useMemo(() => {
    const events: DashboardEvent[] = [];
    
    // A. Logistica
    bookings?.forEach(b => {
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

    // B. Entrate
    finances?.income.forEach(inc => {
      events.push({
        id: `pay-${inc.id}`,
        date: new Date(inc.data_scadenza),
        type: 'payment',
        title: `Incasso: €${inc.importo}`,
        subtitle: inc.description || 'Affitto',
        amount: Number(inc.importo),
        priority: 'media',
        status: inc.stato || 'da_pagare',
        targetTab: 'revenue'
      });
    });

    // C. Uscite (Spese Reali)
    finances?.expenses.forEach(exp => {
        // Logica per mostrare il nome corretto (Casa o Veicolo)
        const targetName = exp.properties_real?.nome 
            ? `🏠 ${exp.properties_real.nome}` 
            : (exp.properties_mobile?.veicolo ? `🚛 ${exp.properties_mobile.veicolo}` : 'Generale');

        events.push({
          id: `exp-${exp.id}`,
          date: new Date(exp.scadenza),
          type: 'expense',
          title: `Uscita: €${exp.importo}`,
          subtitle: `${targetName} - ${exp.categoria}`,
          amount: Number(exp.importo),
          priority: 'media',
          status: 'paid',
          targetTab: 'expenses'
        });
    });

    // D. Ticket
    tickets?.forEach(t => {
        events.push({
            id: `tick-${t.id}`,
            date: new Date(t.created_at),
            type: 'maintenance',
            title: `Ticket: ${t.titolo}`,
            subtitle: t.properties_real?.nome || 'Generale',
            priority: t.priorita === 'alta' ? 'alta' : 'media',
            status: t.stato,
            targetTab: 'activities'
        });
    });

    // E. Scadenze Veicoli (NUOVO)
    fleet?.forEach(vehicle => {
        // Revisione
        if (vehicle.data_revisione) {
            const revDate = new Date(vehicle.data_revisione);
            events.push({
                id: `rev-${vehicle.id}`,
                date: revDate,
                type: 'deadline',
                title: `Scad. Revisione`,
                subtitle: `${vehicle.veicolo} (${vehicle.targa})`,
                priority: 'alta',
                status: 'pending',
                targetTab: 'mobile-properties'
            });
        }
        // Assicurazione
        if (vehicle.scadenza_assicurazione) {
            const assDate = new Date(vehicle.scadenza_assicurazione);
            events.push({
                id: `ass-${vehicle.id}`,
                date: assDate,
                type: 'deadline',
                title: `Scad. Assicurazione`,
                subtitle: `${vehicle.veicolo} (${vehicle.targa})`,
                priority: 'alta',
                status: 'pending',
                targetTab: 'mobile-properties'
            });
        }
    });

    // F. KPI
    const kpi = {
      incassato: finances?.income.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      atteso: finances?.income.filter(i => i.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0) || 0,
      uscite: finances?.expenses.reduce((acc, c) => acc + Number(c.importo), 0) || 0
    };

    // G. Urgenze (Inclusi Veicoli)
    const urgencies = [
      ...(tickets?.filter(t => t.priorita === 'alta').map(t => ({
        type: 'ticket', text: `GUASTO: ${t.titolo}`, id: t.id, targetTab: 'activities'
      })) || []),
      ...(finances?.overdue.map(o => ({
        type: 'payment', text: `SCADUTO: €${o.importo}`, id: o.id, targetTab: 'revenue'
      })) || []),
      ...(fleet?.filter(v => v.scadenza_assicurazione && isBefore(new Date(v.scadenza_assicurazione), new Date())).map(v => ({
          type: 'deadline', text: `ASSICURAZIONE SCADUTA: ${v.veicolo}`, id: v.id, targetTab: 'mobile-properties'
      })) || [])
    ];

    return { events, kpi, urgencies };
  }, [bookings, finances, tickets, fleet]);

  const dailyEvents = dashboardData.events.filter(e => 
    selectedDate && isSameDay(e.date, selectedDate)
  );

  const modifiers = {
    hasEvent: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date)),
    hasDeadline: (date: Date) => dashboardData.events.some(e => isSameDay(e.date, date) && e.type === 'deadline'),
  };

  const modifiersStyles = {
    hasEvent: { textDecoration: 'underline', textDecorationColor: '#94a3b8' },
    hasDeadline: { color: '#dc2626', fontWeight: 'bold', border: '1px solid #dc2626', borderRadius: '50%' }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Torre di Controllo</h1>
          <p className="text-gray-500">Panoramica operativa</p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{format(new Date(), 'EEEE d MMMM', { locale: it })}</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200 cursor-pointer hover:bg-green-100" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex justify-between">
            <div><p className="text-sm font-bold text-green-700">INCASSATO</p><h2 className="text-2xl font-bold text-green-900">€ {dashboardData.kpi.incassato.toLocaleString()}</h2></div>
            <CheckCircle className="text-green-600 w-8 h-8" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100" onClick={() => onNavigate('revenue')}>
          <CardContent className="p-6 flex justify-between">
            <div><p className="text-sm font-bold text-blue-700">IN ARRIVO</p><h2 className="text-2xl font-bold text-blue-900">€ {dashboardData.kpi.atteso.toLocaleString()}</h2></div>
            <Clock className="text-blue-600 w-8 h-8" />
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 cursor-pointer hover:bg-red-100" onClick={() => onNavigate('expenses')}>
          <CardContent className="p-6 flex justify-between">
            <div><p className="text-sm font-bold text-red-700">USCITE MENSILI</p><h2 className="text-2xl font-bold text-red-900">€ {dashboardData.kpi.uscite.toLocaleString()}</h2></div>
            <TrendingDown className="text-red-600 w-8 h-8" />
          </CardContent>
        </Card>
      </div>

      {/* URGENZE */}
      {dashboardData.urgencies.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold">Attenzione Richiesta</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {dashboardData.urgencies.map((u, idx) => (
                <li key={idx} className="flex justify-between cursor-pointer hover:underline" onClick={() => onNavigate(u.targetTab)}>
                  <span>{u.text}</span> <ArrowRight className="w-4 h-4" />
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* CALENDARIO & AGENDA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Calendario</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={it}
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                    className="rounded-md border"
                />
            </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col h-[400px]">
            <CardHeader className="bg-slate-50 border-b pb-3">
                <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600"/>
                    Agenda del {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Giorno'}
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
                <div className="divide-y">
                    {dailyEvents.length > 0 ? dailyEvents.map(evt => (
                        <div key={evt.id} className="p-4 hover:bg-slate-50 cursor-pointer flex gap-4 items-center group" onClick={() => onNavigate(evt.targetTab)}>
                            <div className={`p-2 rounded-full ${
                                evt.type === 'checkin' ? 'bg-green-100 text-green-600' :
                                evt.type === 'deadline' ? 'bg-red-100 text-red-600' : 
                                evt.type === 'expense' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100'
                            }`}>
                                {evt.type === 'checkin' && <User className="w-5 h-5" />}
                                {evt.type === 'deadline' && <Truck className="w-5 h-5" />}
                                {evt.type === 'expense' && <TrendingDown className="w-5 h-5" />}
                                {evt.type === 'payment' && <Wallet className="w-5 h-5" />}
                                {evt.type === 'maintenance' && <Wrench className="w-5 h-5" />}
                                {evt.type === 'checkout' && <LogOut className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <h4 className="font-bold text-gray-900">{evt.title}</h4>
                                    {evt.amount && <span className="font-mono text-sm">€{evt.amount}</span>}
                                </div>
                                <p className="text-sm text-gray-500">{evt.subtitle}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
                        </div>
                    )) : (
                        <div className="text-center py-12 text-gray-400">
                            <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p>Nessun evento per questa data.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
      </div>
    </div>
  );
}