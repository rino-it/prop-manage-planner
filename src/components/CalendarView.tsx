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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingDown, AlertTriangle, CheckCircle, Clock,
  Calendar as CalendarIcon, ArrowRight, MapPin, User, Wrench,
  Wallet, LogOut, Bell, Truck, Filter, LayoutGrid, List,
  ExternalLink, ClipboardList
} from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, isBefore, subMonths, addMonths, isSameMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { WeatherWidget } from '@/components/WeatherWidget';
import { geocodeAddress } from '@/utils/geocoding';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';

interface WeatherProperty {
  id: string;
  nome: string;
  address: string;
}

type EventType = 'checkin' | 'checkout' | 'payment' | 'expense' | 'maintenance' | 'deadline' | 'activity';

interface CalendarEvent {
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
  bookingId?: string;
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

export default function CalendarView() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const [agendaFilter, setAgendaFilter] = useState('all');
  const [selectedWeatherProperty, setSelectedWeatherProperty] = useState<string>('');

  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString();
  const rangeEnd = addMonths(endOfMonth(new Date()), 2).toISOString();

  const { data: weatherProperties = [] } = useQuery({
    queryKey: ['calendar-weather-properties'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties_real')
        .select('id, nome, via, citta, provincia, indirizzo')
        .order('nome');
      if (!data) return [];
      return data
        .filter((p) => p.via || p.indirizzo || p.citta)
        .map((p): WeatherProperty => ({
          id: p.id,
          nome: p.nome || 'Senza nome',
          address: p.via
            ? `${p.via}, ${p.citta || ''} ${p.provincia || ''}`.trim()
            : p.indirizzo || p.citta || '',
        }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const activeWeatherProp = weatherProperties.find((p) => p.id === selectedWeatherProperty) || weatherProperties[0];

  const { data: weatherCoords } = useQuery({
    queryKey: ['calendar-weather-coords', activeWeatherProp?.id],
    queryFn: async () => {
      if (!activeWeatherProp) return null;
      const geo = await geocodeAddress(activeWeatherProp.address);
      if (!geo) return null;
      return { lat: geo.lat, lon: geo.lon, name: activeWeatherProp.nome };
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!activeWeatherProp,
  });

  const { data: rawData } = useQuery({
    queryKey: ['calendar-full-data'],
    queryFn: async () => {
      const [bookings, expenses, income, tickets, vehicles, activities, blockedDates] = await Promise.all([
        supabase.from('bookings').select('id, data_inizio, data_fine, nome_ospite, source, properties_real(nome)')
          .or(`data_inizio.gte.${rangeStart},data_fine.lte.${rangeEnd}`),
        supabase.from('payments').select('*, properties_real(nome), properties_mobile(veicolo, targa)')
          .gte('scadenza', rangeStart).lte('scadenza', rangeEnd),
        supabase.from('tenant_payments').select('*')
          .gte('data_scadenza', rangeStart).lte('data_scadenza', rangeEnd),
        supabase.from('tickets').select('*, properties_real(nome)')
          .neq('stato', 'risolto'),
        supabase.from('properties_mobile').select('*').eq('status', 'active'),
        supabase.from('activities').select('*, properties_real(nome), properties_mobile(veicolo, targa)')
          .gte('data', rangeStart).lte('data', rangeEnd),
        supabase.from('property_blocked_dates').select('id, date_start, date_end, reason, source, properties_real(nome)')
          .or(`date_start.gte.${rangeStart},date_end.lte.${rangeEnd}`)
      ]);

      return {
        bookings: bookings.data || [],
        expenses: expenses.data || [],
        income: income.data || [],
        tickets: tickets.data || [],
        vehicles: vehicles.data || [],
        activities: activities.data || [],
        blockedDates: blockedDates.data || []
      };
    }
  });

  const calendarData = useMemo(() => {
    if (!rawData) return { events: [], recentActivities: [] };

    const events: CalendarEvent[] = [];
    const isPast = (date: Date) => isBefore(date, new Date());

    rawData.bookings.forEach(b => {
      const inDate = parseISO(b.data_inizio);
      const outDate = parseISO(b.data_fine);
      events.push({
        id: `in-${b.id}`, date: inDate, type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprieta',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(inDate), bookingId: b.id
      });
      events.push({
        id: `out-${b.id}`, date: outDate, type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprieta',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(outDate), bookingId: b.id
      });
    });

    rawData.expenses.forEach(exp => {
      const target = exp.properties_mobile ? exp.properties_mobile.veicolo : (exp.properties_real?.nome || 'Generale');
      events.push({
        id: `exp-${exp.id}`, date: parseISO(exp.scadenza), type: 'expense',
        title: `Uscita: EUR ${exp.importo}`, subtitle: `${target} - ${exp.categoria}`,
        amount: Number(exp.importo), priority: 'media', status: exp.stato, targetTab: 'expenses',
        isCompleted: exp.stato === 'pagato'
      });
    });

    rawData.income.forEach(inc => {
      events.push({
        id: `inc-${inc.id}`, date: parseISO(inc.data_scadenza), type: 'payment',
        title: `Incasso: EUR ${inc.importo}`, subtitle: inc.description || 'Affitto',
        amount: Number(inc.importo), priority: 'media', status: inc.stato, targetTab: 'revenue',
        isCompleted: inc.stato === 'pagato'
      });
    });

    rawData.tickets.forEach(t => {
      const ticketDate = t.scadenza ? parseISO(t.scadenza) : parseISO(t.created_at);
      events.push({
        id: `tick-${t.id}`, date: ticketDate, type: 'maintenance',
        title: `Ticket: ${t.titolo}`, subtitle: t.properties_real?.nome || 'Generale',
        priority: t.priorita === 'alta' ? 'alta' : 'media', status: t.stato, targetTab: 'tickets',
        isCompleted: t.stato === 'risolto'
      });
    });

    rawData.vehicles.forEach(v => {
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

    rawData.activities.forEach(a => {
      const target = a.properties_mobile ? a.properties_mobile.veicolo : (a.properties_real?.nome || 'Generale');
      const actDate = parseISO(a.data || a.created_at);
      events.push({
        id: `act-${a.id}`, date: actDate, type: 'activity',
        title: a.titolo || 'Attivita', subtitle: `${target} - ${a.descrizione || ''}`,
        priority: 'media', status: a.stato, targetTab: 'activities',
        isCompleted: a.stato === 'completato' || a.stato === 'svolto'
      });
    });

    (rawData.blockedDates || []).forEach(bd => {
      const startDate = parseISO(bd.date_start);
      const endDate = parseISO(bd.date_end);
      const sourceLabel = bd.source?.replace('_ical', '').replace(/^\w/, (c: string) => c.toUpperCase()) || 'Portale';
      events.push({
        id: `block-start-${bd.id}`, date: startDate, type: 'checkin',
        title: `Blocco ${sourceLabel}`, subtitle: bd.properties_real?.nome || 'Proprieta',
        priority: 'bassa', status: 'blocked', targetTab: 'portals',
        isCompleted: isPast(endDate)
      });
      events.push({
        id: `block-end-${bd.id}`, date: endDate, type: 'checkout',
        title: `Fine blocco ${sourceLabel}`, subtitle: bd.properties_real?.nome || 'Proprieta',
        priority: 'bassa', status: 'blocked', targetTab: 'portals',
        isCompleted: isPast(endDate)
      });
    });

    const recentActivities = [...events]
      .filter(e => isPast(e.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);

    return { events, recentActivities };
  }, [rawData]);

  const upcomingEvents = useMemo(() => {
    return calendarData.events
      .filter(e => !isBefore(e.date, new Date()) && !e.isCompleted)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [calendarData.events]);

  const dailyEvents = calendarData.events
    .filter(e => selectedDate && isSameDay(e.date, selectedDate))
    .sort((a, b) => (a.priority === 'alta' ? -1 : 1));

  const filteredAgendaEvents = useMemo(() => {
    const monthEvents = calendarData.events.filter(e => selectedDate && isSameMonth(e.date, selectedDate));

    if (agendaFilter === 'all') return monthEvents;
    if (agendaFilter === 'hospitality') return monthEvents.filter(e => e.type === 'checkin' || e.type === 'checkout');
    if (agendaFilter === 'finance') return monthEvents.filter(e => e.type === 'payment' || e.type === 'expense');
    if (agendaFilter === 'maintenance') return monthEvents.filter(e => e.type === 'maintenance' || e.type === 'deadline');
    if (agendaFilter === 'activity') return monthEvents.filter(e => e.type === 'activity');

    return monthEvents;
  }, [calendarData.events, selectedDate, agendaFilter]);

  const modifiers = {
    hasCheckin: (date: Date) => calendarData.events.some(e => isSameDay(e.date, date) && (e.type === 'checkin' || e.type === 'payment')),
    hasExpense: (date: Date) => calendarData.events.some(e => isSameDay(e.date, date) && (e.type === 'expense' || e.type === 'checkout')),
    hasActivity: (date: Date) => calendarData.events.some(e => isSameDay(e.date, date) && e.type === 'activity'),
    hasWarning: (date: Date) => calendarData.events.some(e => isSameDay(e.date, date) && (e.type === 'deadline' || e.type === 'maintenance')),
  };
  const modifiersStyles = {
    hasCheckin: { color: '#16a34a', fontWeight: 'bold' },
    hasExpense: { color: '#dc2626', fontWeight: 'bold' },
    hasActivity: { color: '#6366f1', fontWeight: 'bold' },
    hasWarning: { textDecoration: 'underline', textDecorationColor: '#f59e0b' }
  };

  const handleNavigate = (path: string, bookingId?: string) => {
    if (bookingId) {
      navigate(`/${path}`, { state: { openBookingId: bookingId } });
    } else {
      navigate(`/${path}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader title="Calendario">
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-xs" size="sm" onClick={() => setIsAgendaOpen(true)}>
          <List className="w-3 h-3 mr-2" /> Agenda Mensile Completa
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLONNA SX: CALENDARIO + METEO + EVENTI GIORNO */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-border">
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

          {weatherProperties.length > 0 && (
            <div className="space-y-2">
              {weatherProperties.length > 1 && (
                <Select
                  value={activeWeatherProp?.id || ''}
                  onValueChange={setSelectedWeatherProperty}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona proprieta" />
                  </SelectTrigger>
                  <SelectContent>
                    {weatherProperties.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {weatherCoords && (
                <WeatherWidget
                  latitude={weatherCoords.lat}
                  longitude={weatherCoords.lon}
                  propertyName={weatherCoords.name}
                  days={5}
                />
              )}
            </div>
          )}

          <Card className="shadow-sm border-l-4 border-l-blue-600 h-[300px] flex flex-col">
            <CardHeader className="py-3 border-b bg-slate-50/50">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600" /> {selectedDate ? format(selectedDate, 'd MMMM', { locale: it }) : 'Oggi'}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              {dailyEvents.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {dailyEvents.map((evt) => (
                    <div key={evt.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer" onClick={() => handleNavigate(evt.targetTab, evt.bookingId)}>
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${evt.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                          {getIcon(evt.type)}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${evt.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>{evt.title}</p>
                          <p className="text-[10px] text-slate-500">{evt.subtitle}</p>
                        </div>
                      </div>
                      {evt.amount && <span className={`text-xs font-bold ${evt.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>EUR {evt.amount}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                  <CheckCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs">Nessun evento per questo giorno.</p>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>

        {/* COLONNA DX: PROSSIMI EVENTI + ULTIME ATTIVITA */}
        <div className="lg:col-span-2 space-y-6">

          {/* PROSSIMI EVENTI (check-in/check-out imminenti e altri) */}
          <Card className="shadow-md border-t-4 border-t-green-500 bg-white">
            <CardHeader className="py-4 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded-full text-green-600"><CalendarIcon className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-lg">Prossimi Eventi</CardTitle>
                  <CardDescription className="text-xs">Check-in, check-out e scadenze imminenti</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((e) => (
                    <div key={e.id} className="p-4 flex items-center justify-between hover:bg-green-50/30 transition-colors cursor-pointer" onClick={() => handleNavigate(e.targetTab, e.bookingId)}>
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-1.5 rounded-lg text-slate-600 shadow-sm border border-slate-100 text-center w-12">
                          <span className="text-sm font-bold leading-none block">{format(e.date, 'dd')}</span>
                          <span className="text-[9px] uppercase text-slate-400 block">{format(e.date, 'MMM')}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-800">{e.title}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {e.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.amount && <span className={`text-xs font-bold ${e.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>EUR {e.amount}</span>}
                        <Badge variant="secondary" className="text-[10px] bg-white border-border text-slate-600">{e.type}</Badge>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nessun evento in programma.</p>
                    <p className="text-xs mt-1">Quando avrai prenotazioni o scadenze, appariranno qui.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ULTIME ATTIVITA (prenotazioni, modifiche, cancellazioni recenti) */}
          <Card className="shadow-md border-t-4 border-t-amber-500 bg-white">
            <CardHeader className="py-4 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600"><Clock className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-lg">Ultime Attivita</CardTitle>
                  <CardDescription className="text-xs">Prenotazioni, modifiche e cancellazioni recenti</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {calendarData.recentActivities.length > 0 ? (
                  calendarData.recentActivities.map((e) => (
                    <div key={e.id} className="p-4 flex items-center justify-between hover:bg-amber-50/30 transition-colors cursor-pointer" onClick={() => handleNavigate(e.targetTab, e.bookingId)}>
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${e.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-600'}`}>
                          {getIcon(e.type)}
                        </div>
                        <div>
                          <h4 className={`font-semibold text-sm ${e.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{e.title}</h4>
                          <p className="text-xs text-slate-500">{format(e.date, 'dd MMM yyyy', { locale: it })} - {e.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.amount && <span className={`text-xs font-bold ${e.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>EUR {e.amount}</span>}
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nessuna attivita recente.</p>
                    <p className="text-xs mt-1">Le attivita completate e gli eventi passati verranno mostrati qui.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* DIALOG: AGENDA MENSILE COMPLETA */}
      <Dialog open={isAgendaOpen} onOpenChange={setIsAgendaOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] !overflow-hidden">
          <div className="flex flex-col h-full min-h-0">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" /> Agenda Mensile: {selectedDate ? format(selectedDate, 'MMMM yyyy') : ''}
              </DialogTitle>
              <DialogDescription>Gestione completa degli eventi del mese.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="all" className="flex-1 min-h-0 flex flex-col overflow-hidden" onValueChange={setAgendaFilter}>
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-slate-100 p-1">
                <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
                <TabsTrigger value="hospitality" className="text-xs">Ospitalita</TabsTrigger>
                <TabsTrigger value="finance" className="text-xs">Finanze</TabsTrigger>
                <TabsTrigger value="maintenance" className="text-xs">Manutenzione</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">Attivita</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-2 pr-2 border rounded-md bg-slate-50/30 p-2">
                <div className="space-y-1">
                  {filteredAgendaEvents.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <Filter className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>Nessun evento trovato per questo filtro.</p>
                    </div>
                  ) : (
                    filteredAgendaEvents.map((evt) => (
                      <div key={evt.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all cursor-pointer group" onClick={() => handleNavigate(evt.targetTab, evt.bookingId)}>
                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg font-bold ${evt.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                          <span className="text-lg leading-none">{format(evt.date, 'dd')}</span>
                          <span className="text-[9px] uppercase leading-none">{format(evt.date, 'MMM')}</span>
                        </div>

                        <div className={`flex-1 ${evt.isCompleted ? 'opacity-50' : ''}`}>
                          <div className="flex justify-between">
                            <h4 className="font-semibold text-sm text-slate-800">{evt.title}</h4>
                            {evt.amount && <span className={`text-xs font-mono font-bold ${evt.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>EUR {evt.amount}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] bg-slate-50">{evt.type}</Badge>
                            <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {evt.subtitle}
                            </span>
                          </div>
                        </div>

                        <div className="text-slate-300 group-hover:text-blue-500">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}