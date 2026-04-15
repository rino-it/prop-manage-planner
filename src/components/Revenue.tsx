import React, { useState, useMemo } from 'react';
import { useRevenue } from '@/hooks/useRevenue';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle, Clock, AlertTriangle, TrendingUp,
  CalendarPlus, Pencil, Plus, Trash2, RefreshCw,
  ChevronDown, ChevronUp, CreditCard, Banknote, Building2, Smartphone, Filter
} from 'lucide-react';
import {
  format, isPast, isToday, addDays, parseISO,
  startOfMonth, endOfMonth, isBefore, isAfter, isWithinInterval,
  addMonths
} from 'date-fns';
import { it } from 'date-fns/locale';

// ─── helpers ─────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  canone_locazione:   '🏠 Canone',
  rimborso_utenze:    '💡 Utenze',
  deposito_cauzionale:'🔒 Deposito',
  extra:              '⭐ Extra',
  altro:              '📋 Altro',
};

const METHOD_OPTIONS = [
  { value: 'bonifico',  label: 'Bonifico', icon: <Building2 className="w-4 h-4" /> },
  { value: 'contanti',  label: 'Contanti', icon: <Banknote className="w-4 h-4" /> },
  { value: 'stripe',    label: 'Stripe / Carta', icon: <CreditCard className="w-4 h-4" /> },
  { value: 'paypal',    label: 'PayPal', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'altro',     label: 'Altro', icon: null },
];

function daysDiff(dateStr: string) {
  const diff = Math.round((new Date().getTime() - parseISO(dateStr).getTime()) / 86400000);
  return diff;
}

function groupByMonth(items: any[]) {
  const map: Record<string, any[]> = {};
  items.forEach(r => {
    const key = format(parseISO(r.payment_date || r.data_scadenza), 'yyyy-MM');
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <Card className={`border ${color}`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-200', '-100')} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueRow({ rev, onIncassa, onEdit, onDelete, onCalendar, showPaidDate }: {
  rev: any;
  onIncassa?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCalendar?: () => void;
  showPaidDate?: boolean;
}) {
  const overdueDays = rev.stato === 'da_pagare' && isPast(parseISO(rev.data_scadenza)) && !isToday(parseISO(rev.data_scadenza))
    ? daysDiff(rev.data_scadenza)
    : null;

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors ${overdueDays ? 'bg-red-50/40' : ''}`}>
      {/* Left */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-1 self-stretch rounded-full shrink-0 mt-1 ${
          rev.stato === 'pagato' ? 'bg-green-400' :
          overdueDays ? 'bg-red-500' : 'bg-amber-400'
        }`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-slate-800 truncate">
              {rev.bookings?.nome_ospite || '—'}
            </span>
            {rev.bookings?.properties_real?.nome && (
              <span className="text-xs bg-orange-50 border border-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {rev.bookings.properties_real.nome}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {CATEGORY_LABELS[rev.category] || rev.category || 'Generico'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            {showPaidDate && rev.payment_date && (
              <span className="text-green-600">
                ✓ Pagato il {format(new Date(rev.payment_date), 'd MMM yyyy', { locale: it })}
                {rev.payment_type && ` · ${rev.payment_type}`}
              </span>
            )}
            {!showPaidDate && (
              <span>Scad. {format(parseISO(rev.data_scadenza), 'd MMM yyyy', { locale: it })}</span>
            )}
            {overdueDays && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {overdueDays}gg di ritardo
              </Badge>
            )}
            {(rev.notes || rev.description) && (
              <span className="italic text-slate-400">"{rev.notes || rev.description}"</span>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-base font-bold tabular-nums ${rev.stato === 'pagato' ? 'text-green-600' : overdueDays ? 'text-red-600' : 'text-slate-700'}`}>
          €{Number(rev.importo).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>

        {rev.stato !== 'pagato' && onIncassa && (
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 gap-1" onClick={onIncassa}>
            <CheckCircle className="w-3 h-3" /> Incassa
          </Button>
        )}
        {rev.stato === 'pagato' && (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 h-7 px-2 text-xs">
            Pagato
          </Badge>
        )}

        {onCalendar && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-700 hover:bg-blue-50" onClick={onCalendar} title="Aggiungi a calendario">
            <CalendarPlus className="w-3.5 h-3.5" />
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-700 hover:bg-blue-50" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function Revenue() {
  const { revenues, createPaymentPlan, confirmPayment, updatePayment, deletePayment, isLoading } = useRevenue();
  const { data: properties } = usePropertiesReal();
  const { toast } = useToast();

  // ── UI state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [confirmDate, setConfirmDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [confirmMethod, setConfirmMethod] = useState('bonifico');
  const [filterProp, setFilterProp] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // ── create form ──
  const [selectedProp, setSelectedProp] = useState('');
  const [form, setForm] = useState({
    booking_id: '', amount: '', date_start: format(new Date(), 'yyyy-MM-dd'),
    category: 'canone_locazione', description: '', is_recurring: false, months: '12',
  });

  // ── edit form ──
  const [editForm, setEditForm] = useState({ amount: '', date_start: '', category: '', description: '' });

  const { data: activeTenants = [] } = useQuery({
    queryKey: ['active-tenants-revenue', selectedProp],
    queryFn: async () => {
      if (!selectedProp) return [];
      const { data } = await supabase
        .from('bookings')
        .select('id, nome_ospite')
        .eq('property_id', selectedProp);
      return data || [];
    },
    enabled: !!selectedProp,
  });

  // ── filtered revenues ──
  const filtered = useMemo(() => {
    if (!revenues) return [];
    return revenues.filter(r => {
      if (filterProp !== 'all') {
        const propId = r.bookings?.property_id || (r as any).property_real_id;
        // match by property name since we don't have direct property_id on row easily
        if (r.bookings?.properties_real?.nome !== properties?.find(p => p.id === filterProp)?.nome) return false;
      }
      if (filterCat !== 'all' && r.category !== filterCat) return false;
      return true;
    });
  }, [revenues, filterProp, filterCat, properties]);

  // ── sections ──
  const today = new Date();
  const in30 = addDays(today, 30);

  const overdue    = filtered.filter(r => r.stato === 'da_pagare' && isPast(parseISO(r.data_scadenza)) && !isToday(parseISO(r.data_scadenza)));
  const upcoming   = filtered.filter(r => r.stato === 'da_pagare' && !isPast(parseISO(r.data_scadenza)));
  const paid       = filtered.filter(r => r.stato === 'pagato');

  const thisWeek   = upcoming.filter(r => isBefore(parseISO(r.data_scadenza), addDays(today, 7)));
  const thisMonth  = upcoming.filter(r => !isBefore(parseISO(r.data_scadenza), addDays(today, 7)) && isBefore(parseISO(r.data_scadenza), in30));
  const later      = upcoming.filter(r => !isBefore(parseISO(r.data_scadenza), in30));

  // ── KPI ──
  const totalPaid     = paid.reduce((s, r) => s + Number(r.importo), 0);
  const totalPending  = upcoming.reduce((s, r) => s + Number(r.importo), 0);
  const totalOverdue  = overdue.reduce((s, r) => s + Number(r.importo), 0);
  const totalNext30   = [...thisWeek, ...thisMonth].reduce((s, r) => s + Number(r.importo), 0);

  // ── grouped paid ──
  const groupedPaid = useMemo(() => groupByMonth(paid), [paid]);

  const fmt = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ── handlers ──
  const handleCreate = async () => {
    if (!form.booking_id || !form.amount) {
      toast({ title: 'Compila tutti i campi obbligatori', variant: 'destructive' });
      return;
    }
    await createPaymentPlan.mutateAsync({
      booking_id: form.booking_id,
      amount: parseFloat(form.amount),
      date_start: new Date(form.date_start),
      category: form.category,
      description: form.description || 'Rata canone',
      is_recurring: form.is_recurring,
      months: parseInt(form.months),
    });
    setCreateOpen(false);
    setForm({ booking_id: '', amount: '', date_start: format(new Date(), 'yyyy-MM-dd'), category: 'canone_locazione', description: '', is_recurring: false, months: '12' });
    setSelectedProp('');
  };

  const handleEdit = (rev: any) => {
    setEditTarget(rev);
    setEditForm({
      amount: rev.importo.toString(),
      date_start: rev.data_scadenza,
      category: rev.category || 'canone_locazione',
      description: rev.description || rev.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    await updatePayment.mutateAsync({
      id: editTarget.id,
      importo: parseFloat(editForm.amount),
      data_scadenza: editForm.date_start,
      category: editForm.category,
      description: editForm.description,
    });
    setEditTarget(null);
  };

  const handleConfirmIncasso = async () => {
    if (!confirmTarget) return;
    await confirmPayment.mutateAsync({
      id: confirmTarget.id,
      paymentDate: confirmDate,
      paymentType: confirmMethod,
    });
    setConfirmTarget(null);
  };

  const downloadIcs = (rev: any) => {
    const text = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `SUMMARY:Incasso ${rev.bookings?.nome_ospite || 'Affitto'} - ${fmt(rev.importo)}`,
      `DESCRIPTION:${rev.notes || rev.description || ''}`,
      `DTSTART;VALUE=DATE:${rev.data_scadenza.replace(/-/g, '')}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    a.download = `scadenza_${rev.data_scadenza}.ics`;
    a.click();
  };

  const toggleMonth = (key: string) => setCollapsedMonths(v => ({ ...v, [key]: !v[key] }));

  // recurring preview
  const recurringTotal = form.is_recurring && form.amount && form.months
    ? parseFloat(form.amount) * parseInt(form.months)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in">

      {/* ── Header ── */}
      <PageHeader title="Incassi & Piani" count={filtered.filter(r => r.stato === 'da_pagare').length}>
        <div className="flex items-center gap-2 flex-wrap">

          {/* Filtro proprietà */}
          <Select value={filterProp} onValueChange={setFilterProp}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-white">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Proprietà" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le proprietà</SelectItem>
              {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Filtro categoria */}
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-8 text-xs w-[140px] bg-white">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nuovo Incasso
          </Button>
        </div>
      </PageHeader>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Incassato" value={fmt(totalPaid)} sub={`${paid.length} pagamenti`}
          color="border-green-200 bg-green-50" icon={<CheckCircle className="w-6 h-6 text-green-600" />} />
        <KpiCard label="In Attesa" value={fmt(totalPending)} sub={`${upcoming.length} rate`}
          color="border-amber-200 bg-amber-50" icon={<Clock className="w-6 h-6 text-amber-600" />} />
        <KpiCard label="Scaduto" value={fmt(totalOverdue)} sub={overdue.length > 0 ? `${overdue.length} rate in ritardo` : 'Tutto in regola ✓'}
          color={totalOverdue > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'} icon={<AlertTriangle className={`w-6 h-6 ${totalOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`} />} />
        <KpiCard label="Prossimi 30gg" value={fmt(totalNext30)} sub={`${thisWeek.length + thisMonth.length} scadenze`}
          color="border-blue-200 bg-blue-50" icon={<TrendingUp className="w-6 h-6 text-blue-600" />} />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue={overdue.length > 0 ? 'overdue' : 'upcoming'}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overdue" className="gap-2">
            {overdue.length > 0 && <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{overdue.length}</span>}
            🔴 Scaduti
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            📅 In Scadenza
            {upcoming.length > 0 && <span className="ml-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{upcoming.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="paid">
            ✅ Storico Pagati
            {paid.length > 0 && <span className="ml-1.5 text-[10px] text-slate-400">{paid.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── SCADUTI ── */}
        <TabsContent value="overdue" className="mt-4">
          {isLoading ? <p className="text-center py-8 text-slate-400">Caricamento...</p>
          : overdue.length === 0 ? (
            <div className="text-center py-14 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Nessun incasso scaduto 🎉</p>
              <p className="text-xs text-green-500 mt-1">Sei in pari con tutti i pagamenti</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {overdue.map(r => (
                  <RevenueRow key={r.id} rev={r}
                    onIncassa={() => { setConfirmTarget(r); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); }}
                    onEdit={() => handleEdit(r)}
                    onDelete={() => { if (confirm('Eliminare?')) deletePayment.mutate(r.id); }}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── IN SCADENZA ── */}
        <TabsContent value="upcoming" className="mt-4 space-y-4">
          {isLoading ? <p className="text-center py-8 text-slate-400">Caricamento...</p>
          : upcoming.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-dashed rounded-xl text-slate-400">
              Nessuna rata in scadenza.
            </div>
          ) : (
            <>
              {thisWeek.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2 px-1">⚡ Questa settimana</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {thisWeek.map(r => (
                        <RevenueRow key={r.id} rev={r}
                          onIncassa={() => { setConfirmTarget(r); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); }}
                          onEdit={() => handleEdit(r)}
                          onDelete={() => { if (confirm('Eliminare?')) deletePayment.mutate(r.id); }}
                          onCalendar={() => downloadIcs(r)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {thisMonth.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2 px-1">📅 Prossimi 30 giorni</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {thisMonth.map(r => (
                        <RevenueRow key={r.id} rev={r}
                          onIncassa={() => { setConfirmTarget(r); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); }}
                          onEdit={() => handleEdit(r)}
                          onDelete={() => { if (confirm('Eliminare?')) deletePayment.mutate(r.id); }}
                          onCalendar={() => downloadIcs(r)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {later.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">🗓 Oltre 30 giorni</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {later.map(r => (
                        <RevenueRow key={r.id} rev={r}
                          onIncassa={() => { setConfirmTarget(r); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); }}
                          onEdit={() => handleEdit(r)}
                          onDelete={() => { if (confirm('Eliminare?')) deletePayment.mutate(r.id); }}
                          onCalendar={() => downloadIcs(r)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── STORICO PAGATI ── */}
        <TabsContent value="paid" className="mt-4 space-y-3">
          {isLoading ? <p className="text-center py-8 text-slate-400">Caricamento...</p>
          : paid.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-dashed rounded-xl text-slate-400">
              Nessun incasso registrato ancora.
            </div>
          ) : (
            groupedPaid.map(([monthKey, items]) => {
              const isCollapsed = collapsedMonths[monthKey];
              const monthTotal = items.reduce((s, r) => s + Number(r.importo), 0);
              const monthLabel = format(parseISO(monthKey + '-01'), 'MMMM yyyy', { locale: it });
              return (
                <div key={monthKey} className="rounded-xl border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    onClick={() => toggleMonth(monthKey)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 capitalize">{monthLabel}</span>
                      <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                        {fmt(monthTotal)}
                      </span>
                      <span className="text-xs text-slate-400">{items.length} pagamenti</span>
                    </div>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y bg-white">
                      {items.map(r => (
                        <RevenueRow key={r.id} rev={r} showPaidDate
                          onDelete={() => { if (confirm('Eliminare?')) deletePayment.mutate(r.id); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* ─────────────────────────────────────────────────────────
          DIALOG: CREA NUOVO INCASSO
      ───────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo Incasso / Piano Rateale</DialogTitle>
            <DialogDescription>Seleziona proprietà e inquilino, poi compila i dettagli.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">

            {/* Step 1: Proprietà */}
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase text-slate-500 tracking-wide">1. Proprietà</Label>
              <div className="grid grid-cols-2 gap-2">
                {properties?.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProp(p.id); setForm(f => ({ ...f, booking_id: '' })); }}
                    className={`text-left p-3 rounded-lg border text-sm font-medium transition-all
                      ${selectedProp === p.id ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    🏠 {p.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Inquilino */}
            {selectedProp && (
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wide">2. Inquilino</Label>
                {activeTenants.length === 0 ? (
                  <p className="text-sm text-slate-400 bg-slate-50 border rounded p-3">Nessun booking per questa proprietà.</p>
                ) : (
                  <div className="grid gap-1.5 max-h-32 overflow-y-auto">
                    {activeTenants.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => setForm(f => ({ ...f, booking_id: t.id }))}
                        className={`text-left p-2.5 rounded-lg border text-sm transition-all
                          ${form.booking_id === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        👤 {t.nome_ospite}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Dettagli */}
            {form.booking_id && (
              <>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wide">3. Dettagli</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Importo (€) *</Label>
                      <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Prima scadenza *</Label>
                      <Input type="date" value={form.date_start} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Note</Label>
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Es. Affitto maggio 2026" />
                  </div>
                </div>

                {/* Step 4: Ricorrenza */}
                <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer text-sm">
                      <RefreshCw className="w-4 h-4 text-blue-500" /> Piano rateale mensile
                    </Label>
                    <Switch checked={form.is_recurring} onCheckedChange={c => setForm(f => ({ ...f, is_recurring: c }))} />
                  </div>
                  {form.is_recurring && (
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Numero di rate mensili</Label>
                      <Input type="number" min="2" max="60" value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} className="bg-white" />
                    </div>
                  )}
                  {recurringTotal && (
                    <div className="text-xs bg-blue-50 border border-blue-100 rounded p-2 text-blue-700">
                      📊 Genererà <strong>{form.months} rate</strong> da <strong>€{parseFloat(form.amount || '0').toLocaleString('it-IT')}</strong> / mese → totale <strong>{fmt(recurringTotal)}</strong>
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button
                className="bg-green-600 hover:bg-green-700 font-bold"
                onClick={handleCreate}
                disabled={!form.booking_id || !form.amount || createPaymentPlan.isPending}
              >
                {createPaymentPlan.isPending ? 'Registrazione...' : form.is_recurring ? `Genera ${form.months} rate` : 'Registra'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────
          DIALOG: MODIFICA
      ───────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Incasso</DialogTitle>
            <DialogDescription>{editTarget?.bookings?.nome_ospite} · {CATEGORY_LABELS[editTarget?.category] || ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Importo (€)</Label>
                <Input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Data Scadenza</Label>
                <Input type="date" value={editForm.date_start} onChange={e => setEditForm(f => ({ ...f, date_start: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Note</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>Annulla</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveEdit} disabled={updatePayment.isPending}>
                {updatePayment.isPending ? 'Salvataggio...' : 'Salva'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────
          DIALOG: CONFERMA INCASSO
      ───────────────────────────────────────────────────────── */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-sm max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferma Incasso</DialogTitle>
            <DialogDescription>
              {confirmTarget?.bookings?.nome_ospite} ·{' '}
              <strong>€{Number(confirmTarget?.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <Label>Data pagamento ricevuto</Label>
              <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Metodo di pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {METHOD_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setConfirmMethod(m.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all
                      ${confirmMethod === m.value ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-400' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>Annulla</Button>
              <Button className="bg-green-600 hover:bg-green-700 font-bold gap-1.5" onClick={handleConfirmIncasso} disabled={confirmPayment.isPending}>
                <CheckCircle className="w-4 h-4" />
                {confirmPayment.isPending ? 'Registrazione...' : 'Conferma Incasso'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
