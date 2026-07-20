import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useGestioni } from '@/hooks/useGestioni';
import { useCassa } from '@/hooks/useCassa';
import { usePropertiesReal } from '@/hooks/useProperties';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildRowsProprieta, type MovProprieta } from '@/utils/estrattoProprieta';
import { dataIncasso } from '@/utils/cassa';
import { hasIncassiLiberi } from '@/lib/dbFeatures';
import { aggregaReportProprieta, type MovReport } from '@/utils/reportProprieta';
import { downloadReportProprieta } from '@/components/ReportProprietaPDF';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { ContoDialog } from '@/components/ContoDialog';
import { GirocontoDialog } from '@/components/GirocontoDialog';
import { AssegnaContiDialog } from '@/components/AssegnaContiDialog';
import { ArchivioEstratti } from '@/components/ArchivioEstratti';
import { useMovimentiSenzaConto } from '@/hooks/useMovimentiSenzaConto';
import { downloadEstrattoConto, type EstrattoRow } from '@/components/EstrattoContoPDF';
import { Plus, Pencil, ArrowLeftRight, Download, Wallet, PiggyBank, AlertTriangle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '€' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
}

// Badge "ultimo movimento": testo relativo + tono per il pallino di stato.
function freshnessLabel(iso: string | null): { text: string; tone: 'fresh' | 'mid' | 'stale' | 'none' } {
  if (!iso) return { text: 'nessun movimento', tone: 'none' };
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return { text: 'oggi', tone: 'fresh' };
  if (days === 1) return { text: 'ieri', tone: 'fresh' };
  return { text: `${days}g fa`, tone: days <= 7 ? 'fresh' : days <= 30 ? 'mid' : 'stale' };
}

function periodLabel(preset: string, from: string, to: string): string {
  if (preset === 'tutto') return 'Tutto';
  if (preset === 'anno') return `Anno ${new Date().getFullYear()}`;
  if (preset === 'mese') {
    return format(new Date(), 'MMMM yyyy');
  }
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

// ─── date filtering ────────────────────────────────────────────────────────────
function inPeriod(dateStr: string | null | undefined, preset: string, from: string, to: string, apertura: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (d < apertura.slice(0, 10)) return false;
  if (preset === 'tutto') return true;
  if (preset === 'anno') {
    const y = new Date().getFullYear().toString();
    return d.startsWith(y);
  }
  if (preset === 'mese') {
    const ym = format(new Date(), 'yyyy-MM');
    return d.startsWith(ym);
  }
  // custom
  return d >= from && d <= to;
}

// ─── estratto builder ─────────────────────────────────────────────────────────
async function buildEstrattoGestione(
  conti: any[],
  preset: string,
  from: string,
  to: string,
): Promise<{ rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number }> {
  const allRows: EstrattoRow[] = [];
  let totEntrate = 0;
  let totUscite = 0;
  let saldoFinale = 0;

  // Periodo selezionato → data di inizio (inclusa). null = dall'origine ("tutto").
  const periodFrom: string | null = preset === 'tutto'
    ? null
    : preset === 'anno'
      ? `${new Date().getFullYear()}-01-01`
      : preset === 'mese'
        ? format(new Date(), 'yyyy-MM') + '-01'
        : from;
  // Sentinella: disabilita il filtro per data_apertura dentro inPeriod, così
  // anche i movimenti antecedenti l'apertura del conto entrano nello storico.
  const NO_APERTURA = '0000-00-00';

  const free = await hasIncassiLiberi();
  for (const conto of conti) {
    const apertura: string = (conto.data_apertura || '0000-00-00').slice(0, 10);

    // Fetch all data in parallel
    const [{ data: incassi }, { data: spese }, { data: giroconti }] = await Promise.all([
      supabase
        .from('tenant_payments')
        .select(`importo, payment_date, data_scadenza, description, notes, stato, booking_id, ${free ? 'properties_real(nome), ' : ''}bookings(nome_ospite, property_id, properties_real(nome, gestione_id))`)
        .eq('conto_id', conto.id)
        .eq('stato', 'pagato')
        .returns<any[]>(),
      supabase
        .from('payments')
        .select('importo, data_pagamento, descrizione, stato, properties_real(nome), properties_mobile(veicolo)')
        .eq('conto_id', conto.id)
        .eq('stato', 'pagato'),
      supabase
        .from('giroconti')
        .select('conto_from, conto_to, importo, data, descrizione')
        .or(`conto_from.eq.${conto.id},conto_to.eq.${conto.id}`),
    ]);

    // Tutti i movimenti del conto (senza alcun filtro per data) normalizzati con
    // delta con segno + riga dell'estratto. La data è troncata a yyyy-MM-dd per
    // confronti e ordinamento coerenti (payments.data_pagamento è un timestamp).
    const movs: Array<{ dateStr: string; signed: number; row: EstrattoRow }> = [];

    for (const inc of incassi || []) {
      const dateStr = (dataIncasso(inc) || '').slice(0, 10);
      if (!dateStr) continue;
      const booking = inc.bookings as any;
      const propNome = booking?.properties_real?.nome || (inc.properties_real as any)?.nome || '';
      const importo = Number(inc.importo);
      movs.push({
        dateStr,
        signed: importo,
        row: {
          data: fmtDate(dateStr),
          descrizione: inc.description || inc.notes || 'Incasso',
          proprieta: propNome,
          conto: conto.nome,
          entrata: importo,
          uscita: 0,
          saldo: 0, // riempito nel passaggio del saldo progressivo
        },
      });
    }

    for (const sp of spese || []) {
      const dateStr = (sp.data_pagamento || '').slice(0, 10);
      if (!dateStr) continue;
      const propNome = (sp.properties_real as any)?.nome || (sp.properties_mobile as any)?.veicolo || '';
      const importo = Number(sp.importo);
      movs.push({
        dateStr,
        signed: -importo,
        row: {
          data: fmtDate(dateStr),
          descrizione: sp.descrizione || 'Spesa',
          proprieta: propNome,
          conto: conto.nome,
          entrata: 0,
          uscita: importo,
          saldo: 0,
        },
      });
    }

    for (const giro of giroconti || []) {
      const dateStr = (giro.data || '').slice(0, 10);
      if (!dateStr) continue;
      const importo = Number(giro.importo);
      if (giro.conto_to === conto.id) {
        movs.push({
          dateStr,
          signed: importo,
          row: {
            data: fmtDate(dateStr),
            descrizione: giro.descrizione || 'Giroconto in entrata',
            proprieta: '',
            conto: conto.nome,
            entrata: importo,
            uscita: 0,
            saldo: 0,
          },
        });
      } else if (giro.conto_from === conto.id) {
        movs.push({
          dateStr,
          signed: -importo,
          row: {
            data: fmtDate(dateStr),
            descrizione: giro.descrizione || 'Giroconto in uscita',
            proprieta: '',
            conto: conto.nome,
            entrata: 0,
            uscita: importo,
            saldo: 0,
          },
        });
      }
    }

    // saldo_iniziale è il saldo del conto ALLA data_apertura (lo stato attuale
    // inserito alla creazione). I movimenti antecedenti l'apertura sono storia
    // pregressa: si ricostruisce il saldo di partenza sottraendoli a ritroso,
    // così il saldo all'apertura resta = saldo_iniziale (può andare in negativo).
    let opening = Number(conto.saldo_iniziale) || 0;
    for (const m of movs) if (m.dateStr < apertura) opening -= m.signed;

    // Saldo progressivo all'inizio del periodo selezionato.
    let runningStart = opening;
    if (periodFrom) for (const m of movs) if (m.dateStr < periodFrom) runningStart += m.signed;

    // Movimenti visibili nel periodo (nessun filtro per apertura → sentinella).
    const events = movs
      .filter(m => inPeriod(m.dateStr, preset, from, to, NO_APERTURA))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    let running = runningStart;
    for (const ev of events) {
      running += ev.signed;
      ev.row.saldo = running;
      allRows.push(ev.row);
      totEntrate += ev.row.entrata;
      totUscite += ev.row.uscita;
    }

    // Saldo finale del conto al termine del periodo selezionato.
    saldoFinale += running;
  }

  return { rows: allRows, totEntrate, totUscite, saldoFinale };
}

// ─── property estratto builder ────────────────────────────────────────────────
async function buildEstrattoProprieta(
  target: { id: string; nome: string; isMobile?: boolean },
  contoNome: (id: string | null) => string,
  preset: string,
  from: string,
  to: string,
): Promise<{ rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number }> {
  const SENTINEL = '1900-01-01';
  const movs: MovProprieta[] = [];
  const free = await hasIncassiLiberi();

  const { data: spese } = await supabase
    .from('payments')
    .select('importo, data_pagamento, descrizione, conto_id, stato')
    .eq('stato', 'pagato')
    .eq(target.isMobile ? 'property_mobile_id' : 'property_real_id', target.id);
  for (const sp of spese || []) {
    const dateStr: string = sp.data_pagamento || '';
    if (!inPeriod(dateStr, preset, from, to, SENTINEL)) continue;
    movs.push({ data: dateStr, descrizione: sp.descrizione || 'Spesa', conto_id: sp.conto_id ?? null, entrata: 0, uscita: Number(sp.importo) });
  }

  if (!target.isMobile) {
    const { data: incassi } = await supabase
      .from('tenant_payments')
      .select(`importo, payment_date, data_scadenza, description, notes, conto_id, stato, ${free ? 'property_id, ' : ''}bookings(property_id)`)
      .eq('stato', 'pagato')
      .returns<any[]>();
    for (const inc of incassi || []) {
      const booking = inc.bookings as any;
      if (booking?.property_id !== target.id && (inc as any).property_id !== target.id) continue;
      const dateStr: string = dataIncasso(inc) || '';
      if (!inPeriod(dateStr, preset, from, to, SENTINEL)) continue;
      movs.push({ data: dateStr, descrizione: inc.description || inc.notes || 'Incasso', conto_id: inc.conto_id ?? null, entrata: Number(inc.importo), uscita: 0 });
    }
  }

  return buildRowsProprieta(movs, target.nome, contoNome);
}

// ─── property report builder ──────────────────────────────────────────────────
async function buildReportProprieta(preset: string, from: string, to: string) {
  const SENTINEL = '1900-01-01';
  const free = await hasIncassiLiberi();
  const [{ data: spese }, { data: incassi }] = await Promise.all([
    supabase
      .from('payments')
      .select('importo, data_pagamento, stato, properties_real(nome), properties_mobile(veicolo)')
      .eq('stato', 'pagato'),
    supabase
      .from('tenant_payments')
      .select(`importo, payment_date, data_scadenza, stato, ${free ? 'properties_real(nome), ' : ''}bookings(properties_real(nome))`)
      .eq('stato', 'pagato')
      .returns<any[]>(),
  ]);

  const movs: MovReport[] = [];
  for (const sp of spese || []) {
    if (!inPeriod(sp.data_pagamento, preset, from, to, SENTINEL)) continue;
    const nome = (sp.properties_real as any)?.nome || (sp.properties_mobile as any)?.veicolo || '';
    movs.push({ proprieta: nome, entrata: 0, uscita: Number(sp.importo) });
  }
  for (const inc of incassi || []) {
    if (!inPeriod(dataIncasso(inc), preset, from, to, SENTINEL)) continue;
    const nome = (inc.bookings as any)?.properties_real?.nome || (inc.properties_real as any)?.nome || '';
    movs.push({ proprieta: nome, entrata: Number(inc.importo), uscita: 0 });
  }
  return aggregaReportProprieta(movs);
}

// ─── EstrattoDialog ───────────────────────────────────────────────────────────
interface EstrattoTarget { level: 'gestione' | 'proprieta'; id: string; nome: string; isMobile?: boolean }

function EstrattoDialog({
  target, onClose, gestioni, properties, contiByGestione, conti,
}: {
  target: EstrattoTarget | null;
  onClose: () => void;
  gestioni: any[];
  properties: Array<{ id: string; nome: string; isMobile: boolean }>;
  contiByGestione: (gid: string) => any[];
  conti: any[];
}) {
  const [level, setLevel] = useState<'gestione' | 'proprieta' | 'report'>('gestione');
  const [gestioneId, setGestioneId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [preset, setPreset] = useState<'tutto' | 'anno' | 'mese' | 'custom'>('tutto');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(new Date(), 'yyyy-01-01'));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) return;
    setLevel(target.level);
    if (target.level === 'gestione') { setGestioneId(target.id); setPropertyId(''); }
    else { setPropertyId(target.id); setGestioneId(''); }
  }, [target]);

  const contoNome = (id: string | null) =>
    id ? (conti.find((c: any) => c.id === id)?.nome || '—') : '—';

  const handleDownload = async () => {
    setLoading(true);
    try {
      if (level === 'report') {
        const report = await buildReportProprieta(preset, from, to);
        await downloadReportProprieta({ periodo: periodLabel(preset, from, to), ...report }, 'report-proprieta.pdf');
        onClose();
        return;
      }
      let result;
      let titolo: string;
      let filename: string;
      if (level === 'gestione') {
        const g = gestioni.find((x: any) => x.id === gestioneId);
        result = await buildEstrattoGestione(contiByGestione(gestioneId), preset, from, to);
        titolo = 'Estratto conto — ' + (g?.nome || '');
        filename = 'estratto-' + (g?.nome || 'gestione').replace(/\s+/g, '-') + '.pdf';
      } else {
        const p = properties.find(x => x.id === propertyId);
        if (!p) { setLoading(false); return; }
        result = await buildEstrattoProprieta(p, contoNome, preset, from, to);
        titolo = 'Estratto conto — ' + p.nome;
        filename = 'estratto-' + p.nome.replace(/\s+/g, '-') + '.pdf';
      }
      await downloadEstrattoConto({ titolo, periodo: periodLabel(preset, from, to), ...result }, filename);
      onClose();
    } catch (err) {
      console.error('Estratto conto error:', err);
    } finally {
      setLoading(false);
    }
  };

  const canDownload = level === 'report' ? true : level === 'gestione' ? !!gestioneId : !!propertyId;

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Estratto conto</DialogTitle>
          <DialogDescription>Scegli cosa esportare e il periodo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg gap-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${level === 'gestione' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              onClick={() => setLevel('gestione')}
            >Per gestione</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${level === 'proprieta' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              onClick={() => setLevel('proprieta')}
            >Per proprietà</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${level === 'report' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              onClick={() => setLevel('report')}
            >Report</button>
          </div>

          {level === 'report' ? (
            <p className="text-xs text-slate-500">
              Entrate, uscite e netto di <strong>tutte le proprietà</strong> a confronto, una riga ciascuna.
            </p>
          ) : level === 'gestione' ? (
            <div className="grid gap-1.5">
              <Label>Gestione</Label>
              <Select value={gestioneId} onValueChange={setGestioneId}>
                <SelectTrigger><SelectValue placeholder="Seleziona gestione…" /></SelectTrigger>
                <SelectContent>
                  {gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label>Proprietà</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Seleziona proprietà…" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.isMobile ? '🚗 ' : '🏠 '}{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Periodo</Label>
            <Select value={preset} onValueChange={v => setPreset(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutto">Tutto</SelectItem>
                <SelectItem value="anno">Anno corrente</SelectItem>
                <SelectItem value="mese">Mese corrente</SelectItem>
                <SelectItem value="custom">Personalizzato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Dal</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Al</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleDownload} disabled={loading || !canDownload} className="gap-1.5">
            <Download className="w-4 h-4" />
            {loading ? 'Generazione...' : 'Scarica PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cassa page ───────────────────────────────────────────────────────────────
export default function Cassa() {
  const { toast } = useToast();
  const { data: gestioni = [] } = useGestioni();
  const { data: conti = [] } = useCassa();

  const { data: senzaConto = [] } = useMovimentiSenzaConto();
  const [assegnaOpen, setAssegnaOpen] = useState(false);

  const [filterGestione, setFilterGestione] = useState('all');
  const [contoDialog, setContoDialog] = useState<{ open: boolean; gestioneId: string; editing?: any }>({
    open: false, gestioneId: '',
  });
  const [giroOpen, setGiroOpen] = useState<{ open: boolean; conti: any[] }>({ open: false, conti: [] });
  const [estratto, setEstratto] = useState<EstrattoTarget | null>(null);

  const gestioniView = filterGestione === 'all'
    ? gestioni
    : gestioni.filter((g: any) => g.id === filterGestione);
  const contiByGestione = (gid: string) => conti.filter((c: any) => c.gestione_id === gid);
  const totaleGestione = (gid: string) =>
    contiByGestione(gid).reduce((s: number, c: any) => s + (c.saldo || 0), 0);
  const totale = conti.reduce((s: number, c: any) => s + (c.saldo || 0), 0);

  const { data: realProps = [] } = usePropertiesReal();
  const { data: mobileProps = [] } = useQuery({
    queryKey: ['cassa-mobile-properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_mobile').select('id, veicolo').eq('status', 'active');
      return data || [];
    },
  });
  const properties = [
    ...(realProps as any[]).map(p => ({ id: p.id, nome: p.nome, isMobile: false })),
    ...(mobileProps as any[]).map(m => ({ id: m.id, nome: m.veicolo || 'Veicolo', isMobile: true })),
  ];

  const openEstratto = (level: 'gestione' | 'proprieta', id: string, nome: string) => {
    setEstratto({ level, id, nome });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <PageHeader title="Cassa">
        <Select value={filterGestione} onValueChange={setFilterGestione}>
          <SelectTrigger className="h-9 w-[180px] bg-white">
            <SelectValue placeholder="Gestione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le gestioni</SelectItem>
            {gestioni.map((g: any) => (
              <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Liquidità totale */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-100">
            <PiggyBank className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liquidità totale</p>
            <p className="font-display text-[1.75rem] leading-none font-bold tabular-nums">{fmt(totale)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Banner movimenti senza conto */}
      {senzaConto.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                Hai <strong>{senzaConto.length}</strong> moviment{senzaConto.length === 1 ? 'o' : 'i'} realizzat{senzaConto.length === 1 ? 'o' : 'i'} senza conto assegnato.
              </p>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setAssegnaOpen(true)}>Assegna</Button>
          </CardContent>
        </Card>
      )}

      {/* Gestioni */}
      {(gestioniView as any[]).map((g: any) => (
        <Card key={g.id}>
          <CardContent className="p-0">
            {/* Header gestione */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b flex-wrap gap-2">
              <span className="font-display font-bold tabular-nums">{g.nome}<span className="text-muted-foreground font-medium"> · </span>{fmt(totaleGestione(g.id))}</span>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setContoDialog({ open: true, gestioneId: g.id })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />Conto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGiroOpen({ open: true, conti: contiByGestione(g.id) })}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />Giroconto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEstratto('gestione', g.id, g.nome)}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />Estratto conto
                </Button>
              </div>
            </div>

            {/* Conti — card per conto (stile estratto bancario) */}
            <div className="p-4">
              {contiByGestione(g.id).length === 0 ? (
                <p className="py-2 text-sm text-slate-400">Nessun conto. Aggiungine uno.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contiByGestione(g.id).map((c: any) => {
                    const fr = freshnessLabel(c.lastMovement);
                    const neg = (c.saldo || 0) < 0;
                    const dot = fr.tone === 'fresh' ? 'bg-green-500'
                      : fr.tone === 'mid' ? 'bg-amber-500'
                      : fr.tone === 'stale' ? 'bg-slate-300' : 'bg-slate-200';
                    return (
                      <div key={c.id} className="group rounded-lg border border-border bg-card p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                              <span className="shrink-0">{c.tipo === 'contanti' ? '💵' : '🏦'}</span>
                              <span className="truncate">{c.nome}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="uppercase tracking-wide">{c.tipo === 'contanti' ? 'Contanti' : 'Banca'}</span>
                              <span className="inline-flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                {fr.text}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            onClick={() => setContoDialog({ open: true, gestioneId: g.id, editing: c })}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className={`font-display text-2xl font-bold tabular-nums ${neg ? 'text-red-600' : 'text-foreground'}`}>
                          {fmt(c.saldo)}
                        </div>
                        {c.iban && (
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard?.writeText(c.iban); toast({ title: 'IBAN copiato' }); }}
                            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors min-w-0"
                            title="Copia IBAN"
                          >
                            <Copy className="w-3 h-3 shrink-0" />
                            <span className="truncate">{c.iban}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Archivio Estratti Conto (stile EdilCRM) */}
      <ArchivioEstratti conti={(gestioniView as any[]).flatMap((g: any) => contiByGestione(g.id))} />

      {/* Dialogs */}
      <ContoDialog
        open={contoDialog.open}
        onOpenChange={o => setContoDialog(s => ({ ...s, open: o }))}
        gestioneId={contoDialog.gestioneId}
        editing={contoDialog.editing}
      />
      <GirocontoDialog
        open={giroOpen.open}
        onOpenChange={o => setGiroOpen(s => ({ ...s, open: o }))}
        conti={giroOpen.conti}
      />
      <EstrattoDialog
        target={estratto}
        onClose={() => setEstratto(null)}
        gestioni={gestioni}
        properties={properties}
        contiByGestione={contiByGestione}
        conti={conti}
      />
      <AssegnaContiDialog open={assegnaOpen} onOpenChange={setAssegnaOpen} />
    </div>
  );
}
