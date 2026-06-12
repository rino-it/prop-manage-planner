import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useGestioni } from '@/hooks/useGestioni';
import { useCassa } from '@/hooks/useCassa';
import { supabase } from '@/integrations/supabase/client';
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
import { downloadEstrattoConto, type EstrattoRow } from '@/components/EstrattoContoPDF';
import { Plus, Pencil, ArrowLeftRight, Download, Wallet, PiggyBank } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '€' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
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
  if (dateStr < apertura) return false;
  if (preset === 'tutto') return true;
  if (preset === 'anno') {
    const y = new Date().getFullYear().toString();
    return dateStr.startsWith(y);
  }
  if (preset === 'mese') {
    const ym = format(new Date(), 'yyyy-MM');
    return dateStr.startsWith(ym);
  }
  // custom
  return dateStr >= from && dateStr <= to;
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

  for (const conto of conti) {
    const apertura: string = conto.data_apertura || '0000-00-00';

    // Fetch all data in parallel
    const [{ data: incassi }, { data: spese }, { data: giroconti }] = await Promise.all([
      supabase
        .from('tenant_payments')
        .select('importo, payment_date, description, notes, stato, booking_id, bookings(nome_ospite, property_id, properties_real(nome, gestione_id))')
        .eq('conto_id', conto.id)
        .eq('stato', 'pagato'),
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

    // Build movement list for this conto
    const events: Array<{ dateStr: string; row: EstrattoRow }> = [];

    for (const inc of incassi || []) {
      const dateStr: string = inc.payment_date || '';
      if (!inPeriod(dateStr, preset, from, to, apertura)) continue;
      const booking = inc.bookings as any;
      const propNome = booking?.properties_real?.nome || '';
      events.push({
        dateStr,
        row: {
          data: fmtDate(dateStr),
          descrizione: inc.description || inc.notes || 'Incasso',
          proprieta: propNome,
          conto: conto.nome,
          entrata: Number(inc.importo),
          uscita: 0,
          saldo: 0, // will be filled in running balance pass
        },
      });
    }

    for (const sp of spese || []) {
      const dateStr: string = sp.data_pagamento || '';
      if (!inPeriod(dateStr, preset, from, to, apertura)) continue;
      const propNome = (sp.properties_real as any)?.nome || (sp.properties_mobile as any)?.veicolo || '';
      events.push({
        dateStr,
        row: {
          data: fmtDate(dateStr),
          descrizione: sp.descrizione || 'Spesa',
          proprieta: propNome,
          conto: conto.nome,
          entrata: 0,
          uscita: Number(sp.importo),
          saldo: 0,
        },
      });
    }

    for (const giro of giroconti || []) {
      const dateStr: string = giro.data || '';
      if (!dateStr || dateStr < apertura) continue;
      // For period filter: giroconti always included if after apertura — still filter by period
      if (!inPeriod(dateStr, preset, from, to, apertura)) continue;

      if (giro.conto_to === conto.id) {
        events.push({
          dateStr,
          row: {
            data: fmtDate(dateStr),
            descrizione: giro.descrizione || 'Giroconto in entrata',
            proprieta: '',
            conto: conto.nome,
            entrata: Number(giro.importo),
            uscita: 0,
            saldo: 0,
          },
        });
      } else if (giro.conto_from === conto.id) {
        events.push({
          dateStr,
          row: {
            data: fmtDate(dateStr),
            descrizione: giro.descrizione || 'Giroconto in uscita',
            proprieta: '',
            conto: conto.nome,
            entrata: 0,
            uscita: Number(giro.importo),
            saldo: 0,
          },
        });
      }
    }

    // Sort chronologically
    events.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // Running balance — starts at saldo_iniziale (matching saldoConto logic).
    // Note: saldo_iniziale represents the opening balance at data_apertura;
    // movements before the selected period already affected the "real" opening balance.
    // We recompute the opening balance for the period as:
    //   saldo_iniziale + all paid movements that are >= apertura but BEFORE the period start.
    // This ensures the final running saldo of the last row equals conto.saldo (for "tutto").
    let runningStart = Number(conto.saldo_iniziale) || 0;

    if (preset !== 'tutto') {
      // Compute saldo at start of period from all movements before the period
      const periodFrom = preset === 'anno'
        ? `${new Date().getFullYear()}-01-01`
        : preset === 'mese'
          ? format(new Date(), 'yyyy-MM') + '-01'
          : from;

      // Incassi before period
      const { data: incBefore } = await supabase
        .from('tenant_payments')
        .select('importo, payment_date, stato')
        .eq('conto_id', conto.id)
        .eq('stato', 'pagato')
        .lt('payment_date', periodFrom)
        .gte('payment_date', apertura);
      for (const i of incBefore || []) runningStart += Number(i.importo);

      // Spese before period
      const { data: spBefore } = await supabase
        .from('payments')
        .select('importo, data_pagamento, stato')
        .eq('conto_id', conto.id)
        .eq('stato', 'pagato')
        .lt('data_pagamento', periodFrom)
        .gte('data_pagamento', apertura);
      for (const s of spBefore || []) runningStart -= Number(s.importo);

      // Giroconti before period
      const { data: giroBefore } = await supabase
        .from('giroconti')
        .select('conto_from, conto_to, importo, data')
        .or(`conto_from.eq.${conto.id},conto_to.eq.${conto.id}`)
        .lt('data', periodFrom)
        .gte('data', apertura);
      for (const g of giroBefore || []) {
        if (g.conto_to === conto.id) runningStart += Number(g.importo);
        if (g.conto_from === conto.id) runningStart -= Number(g.importo);
      }
    }

    let running = runningStart;
    for (const ev of events) {
      running += ev.row.entrata - ev.row.uscita;
      ev.row.saldo = running;
      allRows.push(ev.row);
      totEntrate += ev.row.entrata;
      totUscite += ev.row.uscita;
    }

    // The final saldo for this conto (= conto.saldo for "tutto" preset)
    saldoFinale += conto.saldo;
  }

  return { rows: allRows, totEntrate, totUscite, saldoFinale };
}

// ─── EstrattoDialog ───────────────────────────────────────────────────────────
interface EstrattoTarget { level: 'gestione'; id: string; nome: string }

function EstrattoDialog({
  target,
  onClose,
  contiByGestione,
  totaleGestione,
}: {
  target: EstrattoTarget | null;
  onClose: () => void;
  contiByGestione: (gid: string) => any[];
  totaleGestione: (gid: string) => number;
}) {
  const [preset, setPreset] = useState<'tutto' | 'anno' | 'mese' | 'custom'>('tutto');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(new Date(), 'yyyy-01-01'));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!target) return;
    setLoading(true);
    try {
      const conti = contiByGestione(target.id);
      const { rows, totEntrate, totUscite, saldoFinale } = await buildEstrattoGestione(conti, preset, from, to);
      const periodo = periodLabel(preset, from, to);
      await downloadEstrattoConto(
        {
          titolo: 'Estratto conto — ' + target.nome,
          periodo,
          rows,
          totEntrate,
          totUscite,
          saldoFinale,
        },
        'estratto-' + target.nome.replace(/\s+/g, '-') + '.pdf',
      );
      onClose();
    } catch (err) {
      console.error('Estratto conto error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Estratto conto</DialogTitle>
          <DialogDescription>{target?.nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-1">
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
              <div className="grid gap-1.5">
                <Label>Dal</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Al</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleDownload} disabled={loading} className="gap-1.5">
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
  const { data: gestioni = [] } = useGestioni();
  const { data: conti = [] } = useCassa();

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

  const openEstratto = (level: 'gestione', id: string, nome: string) => {
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
            <p className="text-xs font-semibold uppercase text-slate-500">Liquidità totale</p>
            <p className="text-2xl font-bold">{fmt(totale)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Gestioni */}
      {(gestioniView as any[]).map((g: any) => (
        <Card key={g.id}>
          <CardContent className="p-0">
            {/* Header gestione */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b flex-wrap gap-2">
              <span className="font-bold">{g.nome} · {fmt(totaleGestione(g.id))}</span>
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

            {/* Conti */}
            <div className="divide-y">
              {contiByGestione(g.id).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <span>{c.tipo === 'contanti' ? '💵' : '🏦'} {c.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{fmt(c.saldo)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setContoDialog({ open: true, gestioneId: g.id, editing: c })}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {contiByGestione(g.id).length === 0 && (
                <p className="px-4 py-4 text-sm text-slate-400">Nessun conto. Aggiungine uno.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

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
        contiByGestione={contiByGestione}
        totaleGestione={totaleGestione}
      />
    </div>
  );
}
