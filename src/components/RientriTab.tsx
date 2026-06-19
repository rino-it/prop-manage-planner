import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePianiRientro, useDeletePiano } from '@/hooks/usePianiRientro';
import { PianoRientroDialog } from '@/components/PianoRientroDialog';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, TrendingDown, CalendarClock } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { it } from 'date-fns/locale';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FREQ_LABEL: Record<string, string> = { mensile: 'Mensile', bimestrale: 'Bimestrale', trimestrale: 'Trimestrale', semestrale: 'Semestrale', annuale: 'Annuale', personalizzata: 'Personalizzata' };

export default function RientriTab() {
  const { data: piani = [], isLoading } = usePianiRientro();
  const deletePiano = useDeletePiano();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const attivi = (piani as any[]).filter(p => p.stato === 'attivo');
  const inRitardo = attivi.filter(p => p.stats.inRitardo).length;
  const residuoTotale = attivi.reduce((s, p) => s + p.stats.residuo, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-primary" />Archivio Rientri</h3>
          <p className="text-xs text-muted-foreground">Piani di rientro e rateizzazioni di debiti e crediti.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nuovo piano di rientro</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Piani attivi</p><p className="text-2xl font-bold">{attivi.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">In ritardo</p><p className={`text-2xl font-bold ${inRitardo ? 'text-red-600' : ''}`}>{inRitardo}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Residuo totale</p><p className="text-2xl font-bold">€ {fmt(residuoTotale)}</p></CardContent></Card>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Caricamento…</p>}
      {!isLoading && (piani as any[]).length === 0 && <p className="text-muted-foreground text-sm">Nessun piano di rientro. Creane uno con il pulsante in alto.</p>}

      <div className="space-y-3">
        {(piani as any[]).map(p => {
          const s = p.stats;
          const next = s.prossimaRata;
          const gg = next ? differenceInCalendarDays(parseISO(next.scadenza), new Date()) : null;
          const isOpen = expanded === p.id;
          return (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{p.fornitore}</span>
                      <Badge variant={p.stato === 'attivo' ? 'default' : 'secondary'}>{p.stato}</Badge>
                      <Badge variant="outline">{p.direzione === 'entrata' ? 'Credito' : 'Debito'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.ratePagate}/{s.totaleRate} rate — € {fmt(s.importoPagato)} pagati</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">€ {fmt(Number(p.importo_totale))}</p>
                    <p className="text-xs text-muted-foreground">Residuo € {fmt(s.residuo)}</p>
                  </div>
                </div>
                <Progress value={s.percentuale} />
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <span>{FREQ_LABEL[p.frequenza] || p.frequenza} · dal {format(parseISO(p.data_prima_rata), 'd MMM yyyy', { locale: it })}</span>
                  {next && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />Prossima: {format(parseISO(next.scadenza), 'd MMM yyyy', { locale: it })} · € {fmt(Number(next.importo))}
                      {gg !== null && <span className={gg < 0 ? 'text-red-600' : ''}>· {gg < 0 ? `${-gg}gg fa` : `tra ${gg}gg`}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : p.id)}>
                    {isOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />} Rate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Eliminare il piano? Le rate non pagate verranno rimosse.')) deletePiano.mutate(p.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
                {isOpen && (
                  <div className="border-t pt-2 space-y-1">
                    {p.rate.map((r: any) => {
                      const pagata = r.stato === 'pagato' || r.stato === 'rimborsato';
                      return (
                        <div key={r.id} className="flex justify-between text-xs">
                          <span>Rata {r.rata_numero} · {format(parseISO(r.scadenza), 'd MMM yyyy', { locale: it })}</span>
                          <span className={pagata ? 'text-emerald-600' : ''}>€ {fmt(Number(r.importo))} {pagata ? '✓' : ''}</span>
                        </div>
                      );
                    })}
                    {p.consolidate.length > 0 && (
                      <p className="text-xs text-muted-foreground pt-1">{p.consolidate.length} fatture originali consolidate</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PianoRientroDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }} piano={editing} />
    </div>
  );
}
