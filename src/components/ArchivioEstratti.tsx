import { useRef, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Trash2, ExternalLink, Upload, Loader2, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useContoEstratti, type ContoEstratto } from '@/hooks/useContoEstratti';
import { isAllegatoTypeValid, ALLEGATO_MAX_BYTES } from '@/utils/allegato';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const periodo = (anno: number, mese: number | null) => (mese ? `${MESI[mese - 1]} ${anno}` : String(anno));

async function openEstratto(path: string, onError: () => void) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) { onError(); return; }
  window.open(data.signedUrl, '_blank');
}

interface Conto { id: string; nome: string; tipo: string }

function ContoPanel({ conto, files }: { conto: Conto; files: ContoEstratto[] }) {
  const { toast } = useToast();
  const { upload, remove } = useContoEstratti();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [mese, setMese] = useState<string>('none');

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!isAllegatoTypeValid(f)) { toast({ title: 'Formato non supportato', description: 'Carica un PDF o un’immagine.', variant: 'destructive' }); return; }
    if (f.size > ALLEGATO_MAX_BYTES) { toast({ title: 'File troppo grande', description: 'Massimo 10 MB.', variant: 'destructive' }); return; }
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({ conto_id: conto.id, file, anno, mese: mese === 'none' ? null : Number(mese) });
      setFile(null); setMese('none');
      toast({ title: 'Estratto caricato' });
    } catch (err: any) {
      toast({ title: 'Errore caricamento', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      {files.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun estratto per questo conto.</p>
      )}
      {files.map(f => (
        <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <div className="p-1.5 rounded bg-muted text-muted-foreground shrink-0"><FileText className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{periodo(f.anno, f.mese)}</div>
            <div className="text-xs text-muted-foreground truncate">{f.filename}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 shrink-0"
            onClick={() => openEstratto(f.path, () => toast({ title: 'Impossibile aprire il file', variant: 'destructive' }))}>
            <ExternalLink className="w-3.5 h-3.5" />Apri
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
            onClick={() => { if (confirm('Eliminare questo estratto?')) remove.mutate(f); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {/* Carica nuovo */}
      <div className="rounded-lg border border-dashed border-border p-3 flex flex-wrap items-end gap-3">
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
        <div className="grid gap-1.5">
          <Label className="text-xs">File</Label>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 justify-start min-w-[160px]" onClick={() => inputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[180px]">{file ? file.name : 'Scegli file…'}</span>
          </Button>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Anno</Label>
          <Input type="number" value={anno} onChange={e => setAnno(Number(e.target.value))} className="h-9 w-[90px]" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Mese</Label>
          <Select value={mese} onValueChange={setMese}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— (anno intero)</SelectItem>
              {MESI.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={doUpload} disabled={!file || upload.isPending}>
          {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Carica
        </Button>
      </div>
    </div>
  );
}

export function ArchivioEstratti({ conti }: { conti: Conto[] }) {
  const { data: estratti = [] } = useContoEstratti();
  if (conti.length === 0) return null;

  const byConto = (id: string) => estratti.filter(e => e.conto_id === id);
  const badge = (files: ContoEstratto[]) => {
    const n = files.length;
    const mesi = new Set(files.filter(f => f.mese != null).map(f => `${f.anno}-${f.mese}`)).size;
    if (n === 0) return 'vuoto';
    return `${n} file${mesi > 0 ? ` · ${mesi} ${mesi === 1 ? 'mese' : 'mesi'}` : ''}`;
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Archive className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-base font-bold">Archivio Estratti Conto</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {conti.map(c => {
            const files = byConto(c.id);
            return (
              <AccordionItem key={c.id} value={c.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between gap-3 w-full pr-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-left">
                      <span className="shrink-0">{c.tipo === 'contanti' ? '💵' : '🏦'}</span>
                      <span className="truncate">{c.nome}</span>
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${files.length ? 'bg-muted text-muted-foreground' : 'text-muted-foreground/60'}`}>
                      {badge(files)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ContoPanel conto={c} files={files} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
