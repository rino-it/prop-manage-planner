import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { useGestioni } from '@/hooks/useGestioni';
import { useConti } from '@/hooks/useConti';
import { useMovimentiSenzaConto } from '@/hooks/useMovimentiSenzaConto';
import { useToast } from '@/hooks/use-toast';

const fmtDate = (iso: string) => { try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; } };
const fmt = (n: number) => '€' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AssegnaContiDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: gestioni = [] } = useGestioni();
  const { data: conti = [] } = useConti();
  const { data: movimenti = [], assegna } = useMovimentiSenzaConto();
  const { toast } = useToast();

  const [gestioneId, setGestioneId] = useState('');
  const [contoDefault, setContoDefault] = useState('');
  const [perRow, setPerRow] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const contiGestione = useMemo(
    () => (conti as any[]).filter(c => c.gestione_id === gestioneId),
    [conti, gestioneId],
  );

  const visibili = useMemo(
    () => (movimenti as any[]).filter(m => m.gestione_id === gestioneId || m.gestione_id == null),
    [movimenti, gestioneId],
  );

  const key = (m: any) => `${m.tipo}:${m.id}`;

  useEffect(() => { setPerRow({}); setChecked({}); }, [gestioneId]);

  const assegnaSelezionati = () => {
    if (!contoDefault) return;
    setPerRow(prev => {
      const next = { ...prev };
      visibili.forEach(m => { if (checked[key(m)]) next[key(m)] = contoDefault; });
      return next;
    });
  };

  const handleSave = async () => {
    const assignments = visibili
      .map(m => ({ id: m.id, tipo: m.tipo as 'spesa' | 'incasso', conto_id: perRow[key(m)] }))
      .filter(a => !!a.conto_id) as Array<{ id: string; tipo: 'spesa' | 'incasso'; conto_id: string }>;
    if (assignments.length === 0) {
      toast({ title: 'Nessun movimento assegnato', variant: 'destructive' });
      return;
    }
    await assegna.mutateAsync(assignments);
    toast({ title: `${assignments.length} movimenti assegnati` });
    onOpenChange(false);
    setGestioneId(''); setContoDefault('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[calc(100%-1rem)] max-h-[85svh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Assegna movimenti a un conto</DialogTitle>
          <DialogDescription>Scegli la gestione e il conto, poi assegna i movimenti realizzati rimasti senza conto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Gestione</Label>
              <Select value={gestioneId} onValueChange={setGestioneId}>
                <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                <SelectContent>
                  {(gestioni as any[]).map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Conto di default</Label>
              <Select value={contoDefault} onValueChange={setContoDefault} disabled={!gestioneId}>
                <SelectTrigger><SelectValue placeholder="Seleziona conto…" /></SelectTrigger>
                <SelectContent>
                  {contiGestione.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {gestioneId && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-slate-500">{visibili.length} movimenti senza conto</span>
                <Button size="sm" variant="outline" disabled={!contoDefault} onClick={assegnaSelezionati}>
                  Assegna i selezionati al conto di default
                </Button>
              </div>

              <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
                {visibili.length === 0 && <p className="px-4 py-4 text-sm text-slate-400">Nessun movimento da assegnare per questa gestione.</p>}
                {visibili.map(m => (
                  <div key={key(m)} className="flex items-center gap-2.5 px-3 py-2.5">
                    <Checkbox
                      className="shrink-0"
                      checked={!!checked[key(m)]}
                      onCheckedChange={v => setChecked(s => ({ ...s, [key(m)]: !!v }))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${m.tipo === 'incasso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {m.tipo === 'incasso' ? 'Incasso' : 'Spesa'}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-800">{m.descrizione}</span>
                        <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">{fmt(m.importo)}</span>
                      </div>
                      <div className="truncate text-xs text-slate-400 mt-0.5">
                        {fmtDate(m.data)}{m.proprieta ? ` · ${m.proprieta}` : ''}
                      </div>
                    </div>
                    <Select value={perRow[key(m)] || ''} onValueChange={v => setPerRow(s => ({ ...s, [key(m)]: v }))}>
                      <SelectTrigger className="h-9 w-[104px] shrink-0 text-xs"><SelectValue placeholder="Conto…" /></SelectTrigger>
                      <SelectContent>
                        {contiGestione.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={assegna.isPending || !gestioneId}>
            {assegna.isPending ? 'Salvataggio…' : 'Salva assegnazioni'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
