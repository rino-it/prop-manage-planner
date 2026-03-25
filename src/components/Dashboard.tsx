import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock,
  ArrowRight, User, Wrench, Wallet, LogOut, Bell, Truck,
  ClipboardList, Globe, ShoppingBag, ListChecks, MapPin,
  Home, ExternalLink, CalendarDays, ChevronRight, Ticket, Store,
  MessageCircle, Tag
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isBefore, subMonths, addMonths, isSameMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';

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

interface SetupItem {
  id: string;
  label: string;
  description: string;
  targetTab: string;
  completed: boolean;
}

const PORTAL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'VRBO',
  other: 'Altro',
};

const MARKETPLACE_SERVICES = [
  { id: 'cleaning', name: 'Pulizie Professionali', description: 'Gestione automatica turni pulizia', icon: <Wrench className="w-5 h-5" /> },
  { id: 'keybox', name: 'Self Check-in', description: 'Serrature smart e codici accesso', icon: <Home className="w-5 h-5" /> },
  { id: 'insurance', name: 'Assicurazione Ospiti', description: 'Copertura danni e responsabilita civile', icon: <ShoppingBag className="w-5 h-5" /> },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [isUrgencyOpen, setIsUrgencyOpen] = useState(false);

  const { data: portalConnections } = useQuery({
    queryKey: ['dashboard-portal-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_connections')
        .select('id, portal_name, status, last_sync, last_sync_result, properties_real(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const rangeStart = subMonths(startOfMonth(new Date()), 1).toISOString();
  const rangeEnd = addMonths(endOfMonth(new Date()), 2).toISOString();

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

  const { data: properties = [] } = useQuery({
    queryKey: ['dashboard-properties-setup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties_real')
        .select('id, nome, via, citta, indirizzo, telefono, email_contatto, tipo_proprieta');
      return data || [];
    }
  });

  const dashboardData = useMemo(() => {
    if (!rawData) return { events: [], kpi: { incassato: 0, atteso: 0, uscite: 0 }, urgencies: [] };

    const events: DashboardEvent[] = [];
    const isPast = (date: Date) => isBefore(date, new Date());

    rawData.bookings.forEach(b => {
      const inDate = parseISO(b.data_inizio);
      const outDate = parseISO(b.data_fine);
      events.push({
        id: `in-${b.id}`, date: inDate, type: 'checkin',
        title: `Check-in: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprieta',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(inDate)
      });
      events.push({
        id: `out-${b.id}`, date: outDate, type: 'checkout',
        title: `Check-out: ${b.nome_ospite}`, subtitle: b.properties_real?.nome || 'Proprieta',
        priority: 'alta', status: 'pending', targetTab: 'bookings',
        isCompleted: isPast(outDate)
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

    const now = new Date();
    const currentMonthIncome = rawData.income.filter(i => isSameMonth(parseISO(i.data_scadenza), now));
    const currentMonthExpenses = rawData.expenses.filter(e => isSameMonth(parseISO(e.scadenza), now));

    const kpi = {
      incassato: currentMonthIncome.filter(i => i.stato === 'pagato').reduce((acc, c) => acc + Number(c.importo), 0),
      atteso: currentMonthIncome.filter(i => i.stato === 'da_pagare').reduce((acc, c) => acc + Number(c.importo), 0),
      uscite: currentMonthExpenses.reduce((acc, c) => acc + Number(c.importo), 0)
    };

    const urgencies = events.filter(e =>
      (e.priority === 'alta' && isBefore(e.date, new Date()) && !e.isCompleted) ||
      (e.type === 'maintenance' && !e.isCompleted) ||
      (e.type === 'payment' && !e.isCompleted && isBefore(e.date, new Date())) ||
      (e.type === 'activity' && !e.isCompleted && isBefore(e.date, new Date()))
    );

    return { events, kpi, urgencies };
  }, [rawData]);

  const setupItems = useMemo((): SetupItem[] => {
    const items: SetupItem[] = [];

    const hasProperties = properties.length > 0;
    items.push({
      id: 'add-property',
      label: 'Aggiungi la tua prima proprieta',
      description: 'Inserisci almeno una proprieta per iniziare a gestire prenotazioni e inquilini.',
      targetTab: 'properties',
      completed: hasProperties,
    });

    const propertiesWithAddress = properties.filter(p => p.via || p.indirizzo || p.citta);
    items.push({
      id: 'property-address',
      label: 'Completa gli indirizzi delle proprieta',
      description: `${propertiesWithAddress.length}/${properties.length} proprieta hanno un indirizzo completo.`,
      targetTab: 'properties',
      completed: hasProperties && propertiesWithAddress.length === properties.length,
    });

    const propertiesWithContact = properties.filter(p => p.telefono || p.email_contatto);
    items.push({
      id: 'property-contact',
      label: 'Aggiungi informazioni di contatto',
      description: 'Telefono o email per le proprieta, utili per comunicazioni agli ospiti.',
      targetTab: 'properties',
      completed: hasProperties && propertiesWithContact.length === properties.length,
    });

    const hasBookings = (rawData?.bookings.length || 0) > 0;
    items.push({
      id: 'first-booking',
      label: 'Crea la prima prenotazione',
      description: 'Registra una prenotazione per tenere traccia di check-in, check-out e incassi.',
      targetTab: 'bookings',
      completed: hasBookings,
    });

    items.push({
      id: 'connect-portal',
      label: 'Connetti un portale di prenotazione',
      description: 'Collega Airbnb, Booking.com o altri per sincronizzare automaticamente.',
      targetTab: 'portali',
      completed: (portalConnections || []).length > 0,
    });

    return items;
  }, [properties, rawData, portalConnections]);

  const pendingSetupItems = setupItems.filter(i => !i.completed);
  const completedSetupCount = setupItems.filter(i => i.completed).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      <PageHeader title="Homepage">
        <span className="text-sm font-medium text-muted-foreground hidden md:block">{format(new Date(), 'EEEE d MMMM', { locale: it })}</span>
      </PageHeader>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Incassato (Mese)"
          value={`${dashboardData.kpi.incassato.toLocaleString()} EUR`}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="green"
        />
        <KpiCard
          title="Previsione"
          value={`${dashboardData.kpi.atteso.toLocaleString()} EUR`}
          icon={<Clock className="w-5 h-5" />}
          iconColor="blue"
        />
        <KpiCard
          title="Uscite (Mese)"
          value={`${dashboardData.kpi.uscite.toLocaleString()} EUR`}
          icon={<TrendingDown className="w-5 h-5" />}
          iconColor="red"
        />
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('properties')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Home className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold text-foreground">{properties.length}</p>
              <p className="text-[11px] text-muted-foreground">Proprieta</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('bookings')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg text-green-600"><CalendarDays className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold text-foreground">{rawData?.bookings.length || 0}</p>
              <p className="text-[11px] text-muted-foreground">Prenotazioni</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('tickets')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Ticket className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold text-foreground">{rawData?.tickets.length || 0}</p>
              <p className="text-[11px] text-muted-foreground">Ticket aperti</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('activities')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-violet-100 p-2 rounded-lg text-violet-600"><ClipboardList className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold text-foreground">{rawData?.activities.filter(a => a.stato !== 'completato' && a.stato !== 'svolto').length || 0}</p>
              <p className="text-[11px] text-muted-foreground">Attivita attive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRIGLIA PRINCIPALE: 3 COLONNE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLONNA 1: STATO PORTALI */}
        <Card className="shadow-md border-t-4 border-t-blue-500 bg-white">
          <CardHeader className="py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Globe className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-base">Stato Portali</CardTitle>
                  <CardDescription className="text-xs">
                    {(portalConnections || []).length > 0
                      ? `${(portalConnections || []).filter((c: { status: string }) => c.status === 'active').length} attivi su ${(portalConnections || []).length}`
                      : 'Nessun portale connesso'}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600" onClick={() => onNavigate('portali')}>
                Gestisci <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(portalConnections || []).length === 0 ? (
              <div className="p-6 text-center">
                <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">Connetti i tuoi portali per importare prenotazioni</p>
                <Button variant="outline" size="sm" onClick={() => onNavigate('portali')}>
                  Connetti portale
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(portalConnections || []).map((conn: { id: string; portal_name: string; status: string; last_sync: string | null; properties_real: { nome: string } | null }) => (
                  <div key={conn.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${conn.status === 'active' ? 'bg-green-100 text-green-600' : conn.status === 'error' ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400'}`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {PORTAL_LABELS[conn.portal_name] || conn.portal_name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {conn.properties_real?.nome || ''}{conn.last_sync ? ` - Sync: ${format(new Date(conn.last_sync), 'dd/MM HH:mm')}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={conn.status === 'active' ? 'default' : 'secondary'}
                      className={`text-[10px] ${
                        conn.status === 'active' ? 'bg-green-100 text-green-700 border-green-200'
                        : conn.status === 'error' ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {conn.status === 'active' ? 'Attivo' : conn.status === 'error' ? 'Errore' : 'Inattivo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLONNA 2: PRIME COSE DA FARE */}
        <Card className="shadow-md border-t-4 border-t-amber-500 bg-white">
          <CardHeader className="py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600"><ListChecks className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-base">Prime Cose da Fare</CardTitle>
                  <CardDescription className="text-xs">{completedSetupCount}/{setupItems.length} completate</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingSetupItems.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pendingSetupItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-amber-50/30 transition-colors cursor-pointer" onClick={() => onNavigate(item.targetTab)}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 p-1 rounded-full bg-amber-50 text-amber-500">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-slate-800">{item.label}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium text-slate-700">Configurazione completata</p>
                <p className="text-xs text-slate-400 mt-1">Tutte le operazioni iniziali sono state eseguite.</p>
              </div>
            )}

            {setupItems.filter(i => i.completed).length > 0 && pendingSetupItems.length > 0 && (
              <div className="p-3 border-t bg-green-50/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-700">{completedSetupCount} operazioni gia completate</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLONNA 3: MARKETPLACE */}
        <Card className="shadow-md border-t-4 border-t-purple-500 bg-white">
          <CardHeader className="py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-2 rounded-full text-purple-600"><Store className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-base">Marketplace</CardTitle>
                  <CardDescription className="text-xs">Servizi integrabili per le tue proprieta</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-purple-600" onClick={() => onNavigate('marketplace')}>
                Catalogo <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {MARKETPLACE_SERVICES.map((service) => (
                <div key={service.id} className="p-4 flex items-center gap-3 cursor-pointer hover:bg-purple-50/30 transition-colors" onClick={() => onNavigate('marketplace')}>
                  <div className="p-1.5 rounded-full bg-purple-50 text-purple-500">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{service.name}</p>
                    <p className="text-[10px] text-slate-500">{service.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-600 border-purple-100">
                    8 servizi
                  </Badge>
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-purple-50/30 text-center cursor-pointer hover:bg-purple-50/50 transition-colors" onClick={() => onNavigate('marketplace')}>
              <p className="text-xs text-purple-600 font-medium">Esplora il catalogo completo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CENTRO NOTIFICHE */}
      <Card className="shadow-md border-t-4 border-t-red-500 bg-white">
        <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-100 p-2 rounded-full text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <CardTitle className="text-lg">Centro Notifiche</CardTitle>
              <CardDescription className="text-xs">{dashboardData.urgencies.length} attivita richiedono attenzione</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsUrgencyOpen(true)} className="text-xs">
            Vedi Tutte ({dashboardData.urgencies.length})
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {dashboardData.urgencies.slice(0, 5).map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between hover:bg-red-50/30 transition-colors cursor-pointer" onClick={() => onNavigate(u.targetTab)}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-red-500">{getIcon(u.type)}</div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{u.title}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Scadenza: {format(u.date, 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
            ))}
            {dashboardData.urgencies.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">Nessuna urgenza attiva.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ACCESSO RAPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="shadow-sm border-border bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => onNavigate('calendario')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><CalendarDays className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Calendario</p>
                <p className="text-xs text-slate-500">Agenda e scadenze</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => onNavigate('statistiche')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Statistiche</p>
                <p className="text-xs text-slate-500">Occupancy, ADR, RevPAR</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => onNavigate('prezzi')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-full text-amber-600"><Tag className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Prezzi</p>
                <p className="text-xs text-slate-500">Tariffe proprieta</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </CardContent>
        </Card>
      </div>

      {/* SHEET: CENTRO NOTIFICHE COMPLETO */}
      <Sheet open={isUrgencyOpen} onOpenChange={setIsUrgencyOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Centro Notifiche
            </SheetTitle>
            <SheetDescription>Tutte le attivita scadute o con priorita alta.</SheetDescription>
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
                  <Clock className="w-3 h-3" /> Scadenza: {format(u.date, 'dd MMMM yyyy')}
                </div>
              </div>
            ))}
            {dashboardData.urgencies.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">Nessuna urgenza attiva.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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