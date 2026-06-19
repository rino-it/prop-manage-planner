import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useGestioni } from '@/hooks/useGestioni';
import { useConti } from '@/hooks/useConti';
import {
  CheckCircle, Clock, AlertTriangle, TrendingDown,
  Pencil, Plus, Trash2,
  ChevronDown, ChevronUp, CreditCard, Banknote, Building2, Smartphone,
  Filter, Home, Car, Euro, User, Eye, HandCoins, Undo2,
  Paperclip, Loader2, X, ExternalLink,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  format, isPast, isToday, parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { bucketByScadenza } from '@/utils/scadenze';
import { isAllegatoTypeValid, buildAllegatoPath, displayNameFromPath, ALLEGATO_MAX_BYTES } from '@/utils/allegato';
import RientriTab from '@/components/RientriTab';

// Apre un allegato (path nel bucket documents) in una nuova scheda via signed URL.
async function openAllegato(path: string) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    console.error('Errore apertura allegato:', error);
    alert("Impossibile aprire l'allegato.");
    return;
  }
  window.open(data.signedUrl, '_blank');
}

// ─── constants ────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  manutenzione:  '🔧 Manutenzione',
  utenze:        '💡 Utenze',
  tasse:         '🏛️ Tasse',
  assicurazione: '🛡️ Assicurazione',
  altro:         '📋 Altro',
};

const METHOD_OPTIONS = [
  { value: 'bonifico',  label: 'Bonifico',      icon: <Building2 className="w-4 h-4" /> },
  { value: 'contanti',  label: 'Contanti',       icon: <Banknote className="w-4 h-4" /> },
  { value: 'carta',     label: 'Carta',          icon: <CreditCard className="w-4 h-4" /> },
  { value: 'rid',       label: 'RID',            icon: <Smartphone className="w-4 h-4" /> },
  { value: 'altro',     label: 'Altro',          icon: null },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysDiff(dateStr: string) {
  return Math.round((new Date().getTime() - parseISO(dateStr).getTime()) / 86400000);
}

function groupByMonth(items: any[]) {
  const map: Record<string, any[]> = {};
  items.forEach(r => {
    const key = format(parseISO(r.data_pagamento || r.scadenza), 'yyyy-MM');
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

const fmt = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFull = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── KpiCard ──────────────────────────────────────────────────────────────────
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="font-display text-[1.75rem] leading-none font-bold text-slate-900 tabular-nums truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ExpenseRow ───────────────────────────────────────────────────────────────
function ExpenseRow({ exp, onPaga, onEdit, onDelete, showPaidDate }: {
  exp: any;
  onPaga?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showPaidDate?: boolean;
}) {
  const overdueDays =
    exp.stato === 'da_pagare' &&
    isPast(parseISO(exp.scadenza)) &&
    !isToday(parseISO(exp.scadenza))
      ? daysDiff(exp.scadenza)
      : null;

  const propName = exp.properties_real?.nome || exp.properties_mobile?.veicolo || 'Generale';
  const isMobile = !!exp.property_mobile_id;

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors ${overdueDays ? 'bg-red-50/40' : ''}`}>
      {/* Left */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-1 self-stretch rounded-full shrink-0 mt-1 ${
          exp.stato === 'pagato' ? 'bg-green-400' :
          overdueDays ? 'bg-red-500' : 'bg-amber-400'
        }`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-slate-800 truncate">
              {exp.descrizione || '—'}
            </span>
            <span className={`text-xs border px-2 py-0.5 rounded-full ${isMobile ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
              {isMobile ? <Car className="w-3 h-3 inline mr-1" /> : <Home className="w-3 h-3 inline mr-1" />}
              {propName}
            </span>
            <span className="text-xs text-slate-400">
              {CATEGORY_LABELS[exp.categoria] || exp.categoria || 'Altro'}
            </span>
            {exp.competence === 'tenant' && !exp.is_advance && (
              <span className="text-xs bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                <User className="w-3 h-3 inline mr-1" />Inquilino
              </span>
            )}
            {exp.is_advance && exp.debtor_name && (
              <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                <HandCoins className="w-3 h-3 inline mr-1" />{exp.debtor_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            {showPaidDate && exp.data_pagamento && (
              <span className="text-green-600">
                {exp.is_advance ? '↩︎ Rimborsato' : '✓ Pagato'} il {format(new Date(exp.data_pagamento), 'd MMM yyyy', { locale: it })}
                {exp.payment_method && ` · ${exp.payment_method}`}
              </span>
            )}
            {!showPaidDate && (
              <span>{exp.is_advance ? 'Anticipato' : 'Scad.'} {format(parseISO(exp.scadenza), 'd MMM yyyy', { locale: it })}</span>
            )}
            {overdueDays && !exp.is_advance && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {overdueDays}gg di ritardo
              </Badge>
            )}
            {exp.is_advance && exp.reimbursement_note && (
              <span className="italic text-slate-400 truncate">"{exp.reimbursement_note}"</span>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-display text-base font-bold tabular-nums ${
          exp.is_advance
            ? (exp.stato === 'pagato' ? 'text-slate-500' : 'text-emerald-600')
            : (exp.stato === 'pagato' ? 'text-slate-500' : overdueDays ? 'text-red-600' : 'text-red-500')
        }`}>
          {exp.is_advance ? '€' : '-€'}{fmtFull(Number(exp.importo))}
        </span>

        {exp.stato !== 'pagato' && onPaga && (
          <Button size="sm" className={`h-9 sm:h-8 text-xs gap-1 ${exp.is_advance ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700'}`} onClick={onPaga}>
            {exp.is_advance ? <><Undo2 className="w-3 h-3" /> Rimborsato</> : <><CheckCircle className="w-3 h-3" /> Paga</>}
          </Button>
        )}
        {exp.stato === 'pagato' && (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 h-7 px-2 text-xs">
            {exp.is_advance ? 'Rimborsato' : 'Pagato'}
          </Badge>
        )}

        {exp.allegato_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 text-slate-400 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => openAllegato(exp.allegato_url)}
            title="Apri allegato"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 text-slate-400 hover:text-blue-700 hover:bg-blue-50" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── default form state ───────────────────────────────────────────────────────
const DEFAULT_FORM = {
  targetType: 'real' as 'real' | 'mobile',
  targetId: '',
  importo: '',
  descrizione: '',
  categoria: 'manutenzione',
  scadenza: format(new Date(), 'yyyy-MM-dd'),
  stato: 'da_pagare',
  competence: 'owner' as 'owner' | 'tenant',
  payment_method: 'bonifico',
  visible_tenant: false,
  tenant_booking_id: '',
  is_advance: false,
  debtor_name: '',
  conto_id: '',
  allegato_url: '',
};

// ─── main component ───────────────────────────────────────────────────────────
export default function Expenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: realProperties = [] } = usePropertiesReal();
  const { data: gestioni = [] } = useGestioni();
  const { data: conti = [] } = useConti();

  // UI state
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [confirmDate, setConfirmDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [confirmMethod, setConfirmMethod] = useState('bonifico');
  const [confirmNote, setConfirmNote]   = useState('');
  const [confirmConto, setConfirmConto] = useState('');
  const [filterProp, setFilterProp]     = useState('all');
  const [filterCat, setFilterCat]       = useState('all');
  const [filterType, setFilterType]     = useState('all'); // all | real | mobile
  const [filterGestione, setFilterGestione] = useState('all');
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [uploadingAllegato, setUploadingAllegato] = useState(false);
  // Path dell'allegato già salvato quando il form è stato aperto (per cancellare
  // dallo storage solo al salvataggio, mai un file ancora referenziato dal DB).
  const originalAllegatoRef = useRef('');

  // form
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  // data: mobile properties
  const { data: mobileProperties = [] } = useQuery({
    queryKey: ['mobile-properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo, targa, gestione_id').eq('status', 'active');
      return data || [];
    },
  });

  // data: inquilini lungo termine attivi (per toggle "Inoltra all'inquilino")
  const { data: longTermTenants = [] } = useQuery({
    queryKey: ['long-term-tenants-expenses'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('bookings')
        .select('id, nome_ospite, properties_real(nome)')
        .eq('tipo_affitto', 'lungo')
        .lte('data_inizio', today)
        .gte('data_fine', today);
      return data || [];
    },
  });

  // data: expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['unified-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, properties_real(nome), properties_mobile(veicolo, targa)')
        .order('scadenza', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // mutation: save (create / update)
  const saveExpense = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        importo: parseFloat(form.importo),
        importo_originale: parseFloat(form.importo),
        descrizione: form.descrizione,
        categoria: form.categoria,
        scadenza: form.scadenza,
        stato: form.stato,
        competence: form.is_advance ? 'owner' : form.competence,
        payment_method: form.payment_method,
        user_id: user?.id,
        property_real_id: form.targetType === 'real' ? form.targetId || null : null,
        property_mobile_id: form.targetType === 'mobile' ? form.targetId || null : null,
        visible_tenant: form.is_advance ? false : form.visible_tenant,
        tenant_booking_id: form.is_advance ? null : (form.visible_tenant && form.tenant_booking_id ? form.tenant_booking_id : null),
        is_advance: form.is_advance,
        debtor_name: form.is_advance ? (form.debtor_name?.trim() || null) : null,
        conto_id: form.conto_id || null,
        allegato_url: form.allegato_url || null,
      };
      // Se la spesa viene salvata come pagata senza passare dal flusso "Paga",
      // fissiamo la data pagamento a oggi: evita voci pagate con data_pagamento null
      // che nello Storico verrebbero datate sulla scadenza (date incoerenti).
      if (form.stato === 'pagato') {
        payload.data_pagamento = format(new Date(), 'yyyy-MM-dd');
      }
      if (editingId) {
        const { error } = await supabase.from('payments').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payments').insert(payload);
        if (error) throw error;
      }
      // Il file salvato in precedenza non è più referenziato: rimuovilo dallo storage.
      const original = originalAllegatoRef.current;
      if (original && original !== (form.allegato_url || '')) {
        try { await supabase.storage.from('documents').remove([original]); } catch { /* best-effort */ }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      // Segna il file appena salvato come "originale": così un'eventuale pulizia
      // di chiusura non elimina dallo storage un file ora referenziato dal DB.
      originalAllegatoRef.current = form.allegato_url || '';
      setSheetOpen(false);
      setForm({ ...DEFAULT_FORM });
      setEditingId(null);
      toast({ title: editingId ? 'Spesa aggiornata' : 'Spesa registrata' });
    },
    onError: (err: any) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
  });

  // mutation: confirm payment / reimbursement
  const confirmPayment = useMutation({
    mutationFn: async ({ id, date, method, note, isAdvance, contoId }: { id: string; date: string; method: string; note?: string; isAdvance?: boolean; contoId?: string }) => {
      const update: any = { stato: 'pagato', data_pagamento: date, payment_method: method, conto_id: contoId || null };
      if (isAdvance) update.reimbursement_note = note?.trim() || null;
      const { error } = await supabase.from('payments').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      setConfirmTarget(null);
      setConfirmNote('');
      setConfirmConto('');
      toast({ title: vars.isAdvance ? 'Rimborso registrato' : 'Pagamento confermato' });
    },
    onError: (err: any) => toast({ title: 'Errore', description: err.message, variant: 'destructive' }),
  });

  // mutation: delete
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-expenses'] });
      toast({ title: 'Spesa eliminata' });
    },
  });

  // handlers
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    originalAllegatoRef.current = '';
    setSheetOpen(true);
  };

  const openEdit = (exp: any) => {
    setEditingId(exp.id);
    setForm({
      targetType: exp.property_mobile_id ? 'mobile' : 'real',
      targetId: exp.property_mobile_id || exp.property_real_id || '',
      importo: exp.importo.toString(),
      descrizione: exp.descrizione || '',
      categoria: exp.categoria || 'manutenzione',
      scadenza: exp.scadenza,
      stato: exp.stato || 'da_pagare',
      competence: exp.competence || 'owner',
      payment_method: exp.payment_method || 'bonifico',
      visible_tenant: exp.visible_tenant || false,
      tenant_booking_id: exp.tenant_booking_id || '',
      is_advance: !!exp.is_advance,
      debtor_name: exp.debtor_name || '',
      conto_id: exp.conto_id || '',
      allegato_url: exp.allegato_url || '',
    });
    originalAllegatoRef.current = exp.allegato_url || '';
    setSheetOpen(true);
  };

  const handleAllegatoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // consente di ricaricare lo stesso file in seguito
    if (!file) return;
    if (!isAllegatoTypeValid(file)) {
      toast({ title: 'Formato non supportato', description: "Carica un PDF o un'immagine.", variant: 'destructive' });
      return;
    }
    if (file.size > ALLEGATO_MAX_BYTES) {
      toast({ title: 'File troppo grande', description: 'Dimensione massima 10 MB.', variant: 'destructive' });
      return;
    }
    setUploadingAllegato(true);
    try {
      const prev = form.allegato_url;
      const path = buildAllegatoPath(file.name);
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) throw error;
      // Se il file precedente era un upload di questa sessione (non quello salvato),
      // eliminalo subito: non è mai stato persistito. Quello salvato si elimina solo al save.
      if (prev && prev !== originalAllegatoRef.current) {
        await supabase.storage.from('documents').remove([prev]);
      }
      setForm(f => ({ ...f, allegato_url: path }));
    } catch (err: any) {
      toast({ title: 'Errore caricamento', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAllegato(false);
    }
  };

  const handleAllegatoRemove = () => {
    const path = form.allegato_url;
    // Se è un upload di questa sessione (non quello salvato), eliminalo subito:
    // non è mai stato persistito. Quello salvato verrà eliminato al salvataggio.
    if (path && path !== originalAllegatoRef.current) {
      supabase.storage.from('documents').remove([path]);
    }
    setForm(f => ({ ...f, allegato_url: '' }));
  };

  const handleSheetClose = () => {
    // Pulisci un upload di questa sessione mai salvato (evita file orfani).
    const path = form.allegato_url;
    if (path && path !== originalAllegatoRef.current) {
      supabase.storage.from('documents').remove([path]);
    }
    setSheetOpen(false);
    setForm({ ...DEFAULT_FORM });
    setEditingId(null);
    originalAllegatoRef.current = '';
  };

  const toggleMonth = (key: string) => setCollapsedMonths(v => ({ ...v, [key]: !v[key] }));

  // filtering
  const filtered = useMemo(() => {
    return expenses.filter((ex: any) => {
      // le spese consolidate in un piano di rientro escono dagli scadenzari (restano sotto il piano)
      if (ex.consolidato_in_piano_id) return false;
      if (filterType === 'real' && !ex.property_real_id) return false;
      if (filterType === 'mobile' && !ex.property_mobile_id) return false;
      if (filterProp !== 'all') {
        const match = realProperties?.find(p => p.id === filterProp);
        if (!match || ex.properties_real?.nome !== match.nome) return false;
      }
      if (filterCat !== 'all' && ex.categoria !== filterCat) return false;
      if (filterGestione !== 'all') {
        const realIds = new Set((realProperties || []).filter((p: any) => p.gestione_id === filterGestione).map((p: any) => p.id));
        const mobIds  = new Set((mobileProperties as any[] || []).filter((m: any) => m.gestione_id === filterGestione).map((m: any) => m.id));
        if (!(ex.property_real_id && realIds.has(ex.property_real_id)) &&
            !(ex.property_mobile_id && mobIds.has(ex.property_mobile_id))) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          ex.descrizione, ex.fornitore, ex.note, ex.debtor_name,
          ex.properties_real?.nome, ex.properties_mobile?.veicolo,
          String(ex.importo),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filterType, filterProp, filterCat, realProperties, search, filterGestione, mobileProperties]);

  // sections
  // gli anticipi vivono nella loro tab dedicata e non concorrono ai KPI/bucket delle spese ordinarie
  const ordinary = filtered.filter(ex => !ex.is_advance);
  const advancesAll = filtered.filter(ex => ex.is_advance);

  const ordinaryBuckets = bucketByScadenza(ordinary, new Date(), (e: any) => e.scadenza);
  const overdue   = ordinaryBuckets.overdue;
  const thisWeek  = ordinaryBuckets.thisWeek;   // DayGroup[]
  const thisMonth = ordinaryBuckets.thisMonth;
  const later     = ordinaryBuckets.later;
  const paid      = ordinaryBuckets.paid;
  const upcoming  = [...thisWeek.flatMap(g => g.items), ...thisMonth, ...later];

  const advancesPending  = advancesAll.filter(ex => ex.stato !== 'pagato');
  const advancesRefunded = advancesAll.filter(ex => ex.stato === 'pagato');
  const totalAdvancesPending = advancesPending.reduce((s, ex) => s + Number(ex.importo), 0);

  // KPI
  const totalPaid    = paid.reduce((s, ex) => s + Number(ex.importo), 0);
  const totalPending = upcoming.reduce((s, ex) => s + Number(ex.importo), 0);
  const totalOverdue = overdue.reduce((s, ex) => s + Number(ex.importo), 0);
  const totalNext30  = [...thisWeek.flatMap(g => g.items), ...thisMonth].reduce((s, ex) => s + Number(ex.importo), 0);

  const groupedPaid = useMemo(() => groupByMonth(paid), [paid]);

  return (
    <div className="space-y-6 animate-in fade-in">

      {/* ── Header ── */}
      <PageHeader title="Spese" count={ordinary.filter(ex => ex.stato === 'da_pagare').length}>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:flex-wrap sm:w-auto">

          {/* Ricerca */}
          <Input placeholder="Cerca spese…" value={search} onChange={e => setSearch(e.target.value)}
            className="col-span-2 h-9 sm:h-8 text-xs w-full sm:w-[180px] bg-white" />

          {/* Tipo toggle */}
          <div className="col-span-2 flex bg-white p-0.5 rounded-md border h-9 sm:h-8 sm:w-auto">
            <Button variant={filterType === 'all'    ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')}    className="flex-1 sm:flex-none h-8 sm:h-7 px-3 sm:px-2 text-xs">Tutti</Button>
            <Button variant={filterType === 'real'   ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('real')}   className="flex-1 sm:flex-none h-8 sm:h-7 px-3 sm:px-2 text-xs"><Home className="w-3 h-3" /></Button>
            <Button variant={filterType === 'mobile' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('mobile')} className="flex-1 sm:flex-none h-8 sm:h-7 px-3 sm:px-2 text-xs"><Car className="w-3 h-3" /></Button>
          </div>

          {/* Filtro gestione */}
          <Select value={filterGestione} onValueChange={setFilterGestione}>
            <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[150px] bg-white">
              <SelectValue placeholder="Gestione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le gestioni</SelectItem>
              {gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Filtro proprietà */}
          <Select value={filterProp} onValueChange={setFilterProp}>
            <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[150px] bg-white">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400 shrink-0" />
              <SelectValue placeholder="Proprietà" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le proprietà</SelectItem>
              {realProperties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Filtro categoria */}
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="col-span-2 h-9 sm:h-8 text-xs w-full sm:w-[140px] bg-white">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={openCreate} className="col-span-2 w-full sm:w-auto gap-1.5 h-9 sm:h-8">
            <Plus className="w-4 h-4" /> Nuova Spesa
          </Button>
        </div>
      </PageHeader>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pagate" value={fmt(totalPaid)} sub={`${paid.length} spese`}
          color="border-green-200 bg-green-50" icon={<CheckCircle className="w-6 h-6 text-green-600" />} />
        <KpiCard label="In Attesa" value={fmt(totalPending)} sub={`${upcoming.length} in sospeso`}
          color="border-amber-200 bg-amber-50" icon={<Clock className="w-6 h-6 text-amber-600" />} />
        <KpiCard label="Scadute" value={fmt(totalOverdue)} sub={overdue.length > 0 ? `${overdue.length} in ritardo` : 'Tutto in regola ✓'}
          color={totalOverdue > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'} icon={<AlertTriangle className={`w-6 h-6 ${totalOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`} />} />
        <KpiCard label="Prossimi 30gg" value={fmt(totalNext30)} sub={`${thisWeek.flatMap(g => g.items).length + thisMonth.length} scadenze`}
          color="border-blue-200 bg-blue-50" icon={<TrendingDown className="w-6 h-6 text-blue-600" />} />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue={overdue.length > 0 ? 'overdue' : 'upcoming'}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overdue" className="gap-2">
            {overdue.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {overdue.length}
              </span>
            )}
            🔴 Scadute
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            📅 In Scadenza
            {upcoming.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{upcoming.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="advances">
            💸 Anticipi
            {advancesPending.length > 0 && (
              <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{advancesPending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid">
            ✅ Storico
            {paid.length > 0 && <span className="ml-1.5 text-[10px] text-slate-400">{paid.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="rientri">
            🔁 Rientri
          </TabsTrigger>
        </TabsList>

        {/* ── SCADUTE ── */}
        <TabsContent value="overdue" className="mt-4">
          {isLoading ? (
            <p className="text-center py-8 text-slate-400">Caricamento...</p>
          ) : overdue.length === 0 ? (
            <div className="text-center py-14 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Nessuna spesa scaduta 🎉</p>
              <p className="text-xs text-green-500 mt-1">Sei in pari con tutti i pagamenti</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {overdue.map(ex => (
                  <ExpenseRow key={ex.id} exp={ex}
                    onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); setConfirmConto(''); }}
                    onEdit={() => openEdit(ex)}
                    onDelete={() => { if (confirm('Eliminare questa spesa?')) deleteExpense.mutate(ex.id); }}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── IN SCADENZA ── */}
        <TabsContent value="upcoming" className="mt-4 space-y-4">
          {isLoading ? (
            <p className="text-center py-8 text-slate-400">Caricamento...</p>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-dashed rounded-xl text-slate-400">
              Nessuna spesa in scadenza.
            </div>
          ) : (
            <>
              {thisWeek.length > 0 && thisWeek.map(group => (
                <div key={group.date}>
                  <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-red-600 mb-2 px-1">
                    {group.isToday ? '⚡ ' : '📌 '}{group.label}
                  </p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {group.items.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex}
                          onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); setConfirmConto(''); }}
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
              {thisMonth.length > 0 && (
                <div>
                  <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-amber-600 mb-2 px-1">📅 Prossimi 30 giorni</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {thisMonth.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex}
                          onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); setConfirmConto(''); }}
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
              {later.length > 0 && (
                <div>
                  <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">🗓 Oltre 30 giorni</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {later.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex}
                          onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); setConfirmConto(''); }}
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── ANTICIPI ── */}
        <TabsContent value="advances" className="mt-4 space-y-4">
          {/* Banner riassuntivo */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                <HandCoins className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Da farsi rimborsare</p>
                <p className="text-2xl font-bold text-emerald-800 tabular-nums">{fmt(totalAdvancesPending)}</p>
                <p className="text-xs text-emerald-600">{advancesPending.length} anticip{advancesPending.length === 1 ? 'o' : 'i'} apert{advancesPending.length === 1 ? 'o' : 'i'}</p>
              </div>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shrink-0 h-9 w-full sm:w-auto"
              onClick={() => { setEditingId(null); setForm({ ...DEFAULT_FORM, is_advance: true }); originalAllegatoRef.current = ''; setSheetOpen(true); }}>
              <Plus className="w-4 h-4" /> Nuovo Anticipo
            </Button>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-slate-400">Caricamento...</p>
          ) : advancesAll.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-dashed rounded-xl text-slate-400">
              <HandCoins className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nessun anticipo registrato.</p>
              <p className="text-xs mt-1">Registra le spese che hai anticipato per conto di altri.</p>
            </div>
          ) : (
            <>
              {advancesPending.length > 0 && (
                <div>
                  <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 px-1">⏳ Da rimborsare</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {advancesPending.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex}
                          onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); setConfirmConto(''); }}
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare questo anticipo?')) deleteExpense.mutate(ex.id); }}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
              {advancesRefunded.length > 0 && (
                <div>
                  <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">✅ Rimborsati</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {advancesRefunded.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex} showPaidDate
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
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
          {isLoading ? (
            <p className="text-center py-8 text-slate-400">Caricamento...</p>
          ) : paid.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-dashed rounded-xl text-slate-400">
              Nessuna spesa pagata registrata.
            </div>
          ) : (
            groupedPaid.map(([monthKey, items]) => {
              const isCollapsed = collapsedMonths[monthKey];
              const monthTotal = items.reduce((s, ex) => s + Number(ex.importo), 0);
              const monthLabel = format(parseISO(monthKey + '-01'), 'MMMM yyyy', { locale: it });
              return (
                <div key={monthKey} className="rounded-xl border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    onClick={() => toggleMonth(monthKey)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 capitalize">{monthLabel}</span>
                      <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                        -{fmt(monthTotal)}
                      </span>
                      <span className="text-xs text-slate-400">{items.length} spese</span>
                    </div>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y bg-white">
                      {items.map(ex => (
                        <ExpenseRow key={ex.id} exp={ex} showPaidDate
                          onEdit={() => openEdit(ex)}
                          onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── RIENTRI ── */}
        <TabsContent value="rientri" className="mt-4">
          <RientriTab />
        </TabsContent>
      </Tabs>

      {/* ─────────────────────────────────────────────────────────
          SHEET: NUOVA / MODIFICA SPESA
      ───────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { if (o) setSheetOpen(true); else handleSheetClose(); }}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto overscroll-contain rounded-t-2xl">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>{editingId ? 'Modifica Spesa' : 'Nuova Spesa'}</SheetTitle>
            <SheetDescription>
              {editingId ? 'Aggiorna i dettagli della spesa.' : 'Registra una nuova spesa nel gestionale.'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pt-4">
            {/* Toggle Anticipo da rimborsare */}
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                    <HandCoins className="w-4 h-4" /> Anticipo da rimborsare
                  </Label>
                  <p className="text-xs text-emerald-700 mt-0.5">Spesa pagata per conto di terzi, di cui aspetti il rimborso</p>
                </div>
                <Switch
                  checked={form.is_advance}
                  onCheckedChange={v => setForm(f => ({ ...f, is_advance: v, debtor_name: v ? f.debtor_name : '' }))}
                />
              </div>
              {form.is_advance && (
                <div className="grid gap-1.5">
                  <Label className="text-sm sm:text-xs">Chi deve rimborsare</Label>
                  <Input placeholder="Nome del debitore (es. Mario Rossi, Condominio, ecc.)"
                    value={form.debtor_name}
                    onChange={e => setForm(f => ({ ...f, debtor_name: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Tipo: immobile / veicolo */}
            <div className="flex items-center p-1 bg-slate-100 rounded-lg gap-1">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${form.targetType === 'real' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => setForm(f => ({ ...f, targetType: 'real', targetId: '' }))}
              >
                <Home className="w-4 h-4" /> Immobile
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${form.targetType === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                onClick={() => setForm(f => ({ ...f, targetType: 'mobile', targetId: '' }))}
              >
                <Car className="w-4 h-4" /> Veicolo
              </button>
            </div>

            {/* Proprietà / Veicolo */}
            <div className="grid gap-1.5">
              <Label className="text-sm sm:text-xs">Seleziona {form.targetType === 'real' ? 'Proprietà' : 'Veicolo'}</Label>
              <Select value={form.targetId} onValueChange={v => setForm(f => ({ ...f, targetId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {form.targetType === 'real'
                    ? realProperties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)
                    : mobileProperties?.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.veicolo} ({m.targa})</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Importo + Scadenza */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">Importo (€) *</Label>
                <div className="relative">
                  <Euro className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input type="number" className="pl-8" placeholder="0.00"
                    value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">{form.is_advance ? 'Data anticipo *' : 'Scadenza *'}</Label>
                <Input type="date" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))} />
              </div>
            </div>

            {/* Descrizione */}
            <div className="grid gap-1.5">
              <Label className="text-sm sm:text-xs">Descrizione</Label>
              <Input placeholder="Es. Bolletta Enel" value={form.descrizione}
                onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
            </div>

            {/* Categoria + Stato */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">Stato</Label>
                <Select value={form.stato} onValueChange={v => setForm(f => ({ ...f, stato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="da_pagare">{form.is_advance ? '🟠 Da Rimborsare' : '🔴 Da Pagare'}</SelectItem>
                    <SelectItem value="pagato">{form.is_advance ? '🟢 Rimborsato' : '🟢 Pagato'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Metodo + Competenza */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">Metodo pagamento</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="carta">Carta</SelectItem>
                    <SelectItem value="rid">RID</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!form.is_advance && (
                <div className="grid gap-1.5">
                  <Label className="text-sm sm:text-xs">A carico di</Label>
                  <Select value={form.competence} onValueChange={v => setForm(f => ({ ...f, competence: v as 'owner' | 'tenant' }))}>
                    <SelectTrigger className={form.competence === 'tenant' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">🏠 Proprietario</SelectItem>
                      <SelectItem value="tenant">👤 Inquilino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Conto — solo quando la spesa è già pagata */}
            {form.stato === 'pagato' && (
              <div className="grid gap-1.5">
                <Label className="text-sm sm:text-xs">Conto</Label>
                <Select value={form.conto_id} onValueChange={v => setForm(f => ({ ...f, conto_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Da quale conto è uscita…" /></SelectTrigger>
                  <SelectContent>
                    {conti.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Allegato (giustificativo) */}
            <div className="grid gap-1.5">
              <Label className="text-sm sm:text-xs">Allegato (fattura/ricevuta)</Label>
              {form.allegato_url ? (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm truncate flex-1">{displayNameFromPath(form.allegato_url)}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={() => openAllegato(form.allegato_url)}>
                    <ExternalLink className="w-3.5 h-3.5" />Apri
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={handleAllegatoRemove}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative">
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleAllegatoSelect}
                    disabled={uploadingAllegato}
                  />
                  {uploadingAllegato ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />Caricamento…
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Paperclip className="w-4 h-4" />Carica PDF o immagine (max 10 MB)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inoltra all'inquilino — solo se ci sono inquilini lungo termine attivi e non è un anticipo */}
            {longTermTenants.length > 0 && !form.is_advance && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                      <Eye className="w-4 h-4" /> Mostra all'inquilino
                    </Label>
                    <p className="text-xs text-blue-600 mt-0.5">La spesa sarà visibile nel portale inquilino</p>
                  </div>
                  <Switch
                    checked={form.visible_tenant}
                    onCheckedChange={v => setForm(f => ({ ...f, visible_tenant: v, tenant_booking_id: v ? f.tenant_booking_id : '' }))}
                  />
                </div>
                {form.visible_tenant && (
                  <div className="grid gap-1.5">
                    <Label className="text-sm sm:text-xs">Inquilino destinatario</Label>
                    <Select value={form.tenant_booking_id} onValueChange={v => setForm(f => ({ ...f, tenant_booking_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona inquilino..." /></SelectTrigger>
                      <SelectContent>
                        {longTermTenants.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome_ospite} — {(t.properties_real as any)?.nome || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-11 sm:h-10" onClick={handleSheetClose}>Annulla</Button>
              <Button
                className="flex-1 h-11 sm:h-10 bg-red-600 hover:bg-red-700 font-bold"
                onClick={() => saveExpense.mutate()}
                disabled={!form.importo || saveExpense.isPending || uploadingAllegato}
              >
                {saveExpense.isPending ? 'Salvataggio...' : editingId ? 'Salva Modifiche' : 'Registra Spesa'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─────────────────────────────────────────────────────────
          DIALOG: CONFERMA PAGAMENTO
      ───────────────────────────────────────────────────────── */}
      <Dialog open={!!confirmTarget} onOpenChange={o => !o && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-sm max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{confirmTarget?.is_advance ? 'Conferma Rimborso' : 'Conferma Pagamento'}</DialogTitle>
            <DialogDescription>
              {confirmTarget?.descrizione || '—'} ·{' '}
              <strong>{confirmTarget?.is_advance ? '' : '-'}€{fmtFull(Number(confirmTarget?.importo || 0))}</strong>
              {confirmTarget?.is_advance && confirmTarget?.debtor_name && (
                <> · da <strong>{confirmTarget.debtor_name}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <Label>{confirmTarget?.is_advance ? 'Data rimborso ricevuto' : 'Data pagamento effettuato'}</Label>
              <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{confirmTarget?.is_advance ? 'Come hai ricevuto il rimborso' : 'Metodo di pagamento'}</Label>
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
            <div className="grid gap-2">
              <Label>Conto</Label>
              <Select value={confirmConto} onValueChange={setConfirmConto}>
                <SelectTrigger><SelectValue placeholder="Da quale conto è uscita…" /></SelectTrigger>
                <SelectContent>
                  {conti.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {confirmTarget?.is_advance && (
              <div className="grid gap-2">
                <Label>Nota (opzionale)</Label>
                <Input placeholder="Es. ricevuto in contanti al check-out"
                  value={confirmNote} onChange={e => setConfirmNote(e.target.value)} />
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="h-11 sm:h-10" onClick={() => setConfirmTarget(null)}>Annulla</Button>
              <Button
                className={`h-11 sm:h-10 font-bold gap-1.5 ${confirmTarget?.is_advance ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700'}`}
                onClick={() => confirmPayment.mutate({
                  id: confirmTarget.id,
                  date: confirmDate,
                  method: confirmMethod,
                  note: confirmNote,
                  isAdvance: !!confirmTarget.is_advance,
                  contoId: confirmConto || undefined,
                })}
                disabled={confirmPayment.isPending}
              >
                {confirmTarget?.is_advance ? <Undo2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {confirmPayment.isPending ? 'Salvataggio...' : confirmTarget?.is_advance ? 'Registra Rimborso' : 'Conferma Pagamento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
