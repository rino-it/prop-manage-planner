import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGestioni } from '@/hooks/useGestioni';
import { useCreatePiano, useUpdatePiano, type PianoInput } from '@/hooks/usePianiRientro';
import { generateRate, distribuisciImporti, type Frequenza } from '@/utils/rientri';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

const FREQS: { value: Frequenza; label: string }[] = [
  { value: 'mensile', label: 'Mensile' }, { value: 'bimestrale', label: 'Bimestrale' },
  { value: 'trimestrale', label: 'Trimestrale' }, { value: 'semestrale', label: 'Semestrale' },
  { value: 'annuale', label: 'Annuale' },
];
const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PianoRientroDialog({ open, onOpenChange, piano, prefill }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  piano?: any;
  prefill?: { fornitore?: string; importoTotale?: number; gestioneId?: string; consolidaIds?: string[]; direzione?: 'uscita' | 'entrata' };
}) {
  const { data: gestioni = [] } = useGestioni();
  const createPiano = useCreatePiano();
  const updatePiano = useUpdatePiano();
  const { toast } = useToast();
  const isEdit = !!piano;

  const [gestioneId, setGestioneId] = useState('');
  const [fornitore, setFornitore] = useState('');
  const [direzione, setDirezione] = useState<'uscita' | 'entrata'>('uscita');
  const [importoTotale, setImportoTotale] = useState('');
  const [numeroRate, setNumeroRate] = useState('6');
  const [frequenza, setFrequenza] = useState<Frequenza>('mensile');
  const [dataPrimaRata, setDataPrimaRata] = useState('');
  const [custom, setCustom] = useState(false);
  const [righe, setRighe] = useState<{ scadenza: string; importo: string }[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (piano) {
      setGestioneId(piano.gestione_id); setFornitore(piano.fornitore);
      setDirezione(piano.direzione); setImportoTotale(String(piano.importo_totale));
      setNumeroRate(String(piano.numero_rate)); setFrequenza(piano.frequenza === 'personalizzata' ? 'mensile' : piano.frequenza);
      setDataPrimaRata(piano.data_prima_rata); setNote(piano.note || ''); setCustom(false); setRighe([]);
    } else {
      setGestioneId(prefill?.gestioneId || (gestioni as any[])[0]?.id || '');
      setFornitore(prefill?.fornitore || ''); setDirezione(prefill?.direzione || 'uscita');
      setImportoTotale(prefill?.importoTotale ? String(prefill.importoTotale) : '');
      setNumeroRate('6'); setFrequenza('mensile'); setDataPrimaRata(''); setNote(''); setCustom(false); setRighe([]);
    }
  }, [open, piano, prefill, gestioni]);

  // sincronizza la tabella custom quando viene attivata
  useEffect(() => {
    if (!custom) return;
    const tot = parseFloat(importoTotale) || 0;
    const n = Math.max(2, Math.min(60, parseInt(numeroRate) || 0));
    if (!dataPrimaRata) { setRighe(Array.from({ length: n }, () => ({ scadenza: '', importo: '0' }))); return; }
    const base = generateRate({ importoTotale: tot, numeroRate: n, frequenza, dataPrimaRata });
    setRighe(base.map(r => ({ scadenza: r.scadenza, importo: String(r.importo) })));
  }, [custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const sommaRate = useMemo(() => righe.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0), [righe]);
  const atteso = parseFloat(importoTotale) || 0;

  const distribuisci = () => {
    const n = righe.length; if (!n) return;
    const imp = distribuisciImporti(atteso, n);
    setRighe(righe.map((r, i) => ({ ...r, importo: String(imp[i]) })));
  };

  const valid = gestioneId && fornitore.trim() && atteso > 0 && dataPrimaRata &&
    parseInt(numeroRate) >= 2 && parseInt(numeroRate) <= 60;

  const handleSubmit = async () => {
    if (!valid) { toast({ title: 'Compila i campi obbligatori', variant: 'destructive' }); return; }
    const base: PianoInput = {
      gestione_id: gestioneId, fornitore: fornitore.trim(), direzione,
      importo_totale: atteso, numero_rate: parseInt(numeroRate),
      frequenza: custom ? 'personalizzata' : frequenza, data_prima_rata: dataPrimaRata,
      note: note.trim() || null,
    };
    const rate = custom
      ? righe.filter(r => r.scadenza).map(r => ({ scadenza: r.scadenza, importo: parseFloat(r.importo) || 0 }))
      : generateRate({ importoTotale: atteso, numeroRate: parseInt(numeroRate), frequenza, dataPrimaRata });
    try {
      if (isEdit) {
        await updatePiano.mutateAsync({ id: piano.id, piano: base, rateEsistenti: piano.rate });
        toast({ title: 'Piano aggiornato' });
      } else {
        await createPiano.mutateAsync({ piano: base, rate, consolidaIds: prefill?.consolidaIds });
        toast({ title: 'Piano creato', description: `${rate.length} rate generate` });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica Piano di Rientro' : 'Nuovo Piano di Rientro'}</DialogTitle>
          <DialogDescription>Rateizzazione di un debito o credito in più rate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gestione *</Label>
              <Select value={gestioneId} onValueChange={setGestioneId}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{(gestioni as any[]).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={direzione} onValueChange={(v) => setDirezione(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uscita">Debito (pago io)</SelectItem>
                  <SelectItem value="entrata">Credito (ricevo io)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{direzione === 'entrata' ? 'Debitore *' : 'Fornitore *'}</Label>
            <Input value={fornitore} onChange={e => setFornitore(e.target.value)} placeholder="Es. Agenzia delle Entrate" />
          </div>
          <div>
            <Label>Importo totale del piano (€) *</Label>
            <Input type="number" step="0.01" value={importoTotale} onChange={e => setImportoTotale(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Precompilato con la somma delle scadenze selezionate. Modificabile per dilazioni con interessi o sconti.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Numero rate * (2–60)</Label>
              <Input type="number" min={2} max={60} value={numeroRate} onChange={e => setNumeroRate(e.target.value)} />
            </div>
            <div>
              <Label>Frequenza *</Label>
              <Select value={frequenza} onValueChange={(v) => setFrequenza(v as Frequenza)} disabled={custom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Data prima rata *</Label>
            <Input type="date" value={dataPrimaRata} onChange={e => setDataPrimaRata(e.target.value)} />
          </div>
          {!isEdit && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="cursor-pointer">Importi personalizzati per rata</Label>
                  <p className="text-xs text-muted-foreground">Permetti rate di importi diversi (es. acconto più alto e poi rate mensili)</p>
                </div>
                <Switch checked={custom} onCheckedChange={setCustom} />
              </div>
              {custom && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                    <span>Somma rate: <b className={Math.abs(sommaRate - atteso) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}>€ {fmt(sommaRate)}</b> / atteso € {fmt(atteso)}</span>
                    <Button type="button" size="sm" variant="outline" onClick={distribuisci}><Sparkles className="w-3 h-3 mr-1" />Distribuisci</Button>
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {righe.map((r, i) => (
                      <div key={i} className="grid grid-cols-[24px_1fr_110px] gap-2 items-center">
                        <span className="text-xs text-muted-foreground">{i + 1}</span>
                        <Input type="date" value={r.scadenza} onChange={e => setRighe(righe.map((x, j) => j === i ? { ...x, scadenza: e.target.value } : x))} />
                        <Input type="number" step="0.01" value={r.importo} onChange={e => setRighe(righe.map((x, j) => j === i ? { ...x, importo: e.target.value } : x))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note aggiuntive sul piano…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={createPiano.isPending || updatePiano.isPending}>
            {isEdit ? 'Salva modifiche' : 'Crea piano e genera rate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
