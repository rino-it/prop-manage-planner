# Piani di Rientro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di creare un piano di rientro (rateizzazione di debiti o crediti) che genera automaticamente N rate come spese collegate, invece di inserirle una a una.

**Architecture:** Una tabella `piani_rientro` (piano padre) + due colonne su `payments` (`piano_rientro_id`, `rata_numero`, `consolidato_in_piano_id`). Ogni rata è una riga `payments` (uscita = "Paga", entrata = `is_advance` "Rimborsato"). La logica pura di generazione/derivazione vive in `src/utils/rientri.ts` (testata con vitest); hook `usePianiRientro` per CRUD; UI come tab "Rientri" dentro Spese + dialog `PianoRientroDialog`.

**Tech Stack:** React, TypeScript, @tanstack/react-query, Supabase, date-fns, shadcn/ui, vitest.

## Global Constraints

- Tutte le tabelle finanziarie usano RLS owner-based: `user_id = auth.uid()`.
- `gestione_id` obbligatorio e coerente con `conti`/`payments`.
- Importi: numeric, formattati it-IT a 2 decimali nell'UI.
- Date in formato ISO `yyyy-MM-dd` per le `payments.scadenza`.
- `numero_rate` vincolato 2–60.
- `direzione` ∈ {'uscita','entrata'}; `stato` piano ∈ {'attivo','completato','annullato'}.
- Le rate sono `payments`: `is_advance = (direzione === 'entrata')`.

---

### Task 1: Logica pura generazione/derivazione rate (`src/utils/rientri.ts`)

**Files:**
- Create: `src/utils/rientri.ts`
- Test: `src/utils/rientri.test.ts`

**Interfaces:**
- Produces:
  - `type Frequenza = 'mensile'|'bimestrale'|'trimestrale'|'semestrale'|'annuale'|'personalizzata'`
  - `mesiPerFrequenza(f: Frequenza): number` (personalizzata → 0)
  - `interface RataInput { scadenza: string; importo: number }`
  - `generateRate(opts: { importoTotale: number; numeroRate: number; frequenza: Frequenza; dataPrimaRata: string }): RataInput[]` — split equo, ultima rata assorbe l'arrotondamento, date a intervalli.
  - `distribuisciImporti(importoTotale: number, n: number): number[]` — split equo a 2 decimali, ultimo assorbe il resto.
  - `interface RataLike { importo: number; stato?: string|null; is_advance?: boolean|null; scadenza: string; rata_numero?: number|null }`
  - `interface PianoStats { totaleRate: number; ratePagate: number; importoPagato: number; residuo: number; percentuale: number; prossimaRata: RataLike|null; inRitardo: boolean }`
  - `derivePianoStats(rate: RataLike[], importoTotale: number, now?: Date): PianoStats` — pagata = stato ∈ {'pagato','rimborsato'}; prossima = prima non pagata per scadenza; inRitardo = esiste rata non pagata con scadenza < oggi.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { mesiPerFrequenza, distribuisciImporti, generateRate, derivePianoStats } from './rientri';

describe('mesiPerFrequenza', () => {
  it('mappa le frequenze', () => {
    expect(mesiPerFrequenza('mensile')).toBe(1);
    expect(mesiPerFrequenza('bimestrale')).toBe(2);
    expect(mesiPerFrequenza('trimestrale')).toBe(3);
    expect(mesiPerFrequenza('semestrale')).toBe(6);
    expect(mesiPerFrequenza('annuale')).toBe(12);
    expect(mesiPerFrequenza('personalizzata')).toBe(0);
  });
});

describe('distribuisciImporti', () => {
  it('somma esatta con arrotondamento sull ultima', () => {
    const r = distribuisciImporti(100, 3);
    expect(r).toEqual([33.33, 33.33, 33.34]);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });
  it('importi tondi', () => {
    expect(distribuisciImporti(6000, 6)).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
  });
});

describe('generateRate', () => {
  it('genera date mensili e somma esatta', () => {
    const rate = generateRate({ importoTotale: 100, numeroRate: 3, frequenza: 'mensile', dataPrimaRata: '2026-01-31' });
    expect(rate.map(r => r.scadenza)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(rate.reduce((a, b) => a + b.importo, 0)).toBeCloseTo(100, 2);
  });
  it('trimestrale', () => {
    const rate = generateRate({ importoTotale: 300, numeroRate: 2, frequenza: 'trimestrale', dataPrimaRata: '2026-01-15' });
    expect(rate.map(r => r.scadenza)).toEqual(['2026-01-15', '2026-04-15']);
  });
});

describe('derivePianoStats', () => {
  const now = new Date('2026-06-19T00:00:00');
  it('calcola residuo, pagate, prossima, ritardo', () => {
    const rate = [
      { importo: 100, stato: 'pagato', scadenza: '2026-05-01', rata_numero: 1 },
      { importo: 100, stato: 'in_attesa', scadenza: '2026-06-01', rata_numero: 2 },
      { importo: 100, stato: 'in_attesa', scadenza: '2026-07-01', rata_numero: 3 },
    ];
    const s = derivePianoStats(rate, 300, now);
    expect(s.totaleRate).toBe(3);
    expect(s.ratePagate).toBe(1);
    expect(s.importoPagato).toBe(100);
    expect(s.residuo).toBe(200);
    expect(s.percentuale).toBeCloseTo(33.33, 1);
    expect(s.prossimaRata?.rata_numero).toBe(2);
    expect(s.inRitardo).toBe(true); // rata 2 scaduta il 1 giu
  });
  it('rimborsato conta come pagato (crediti)', () => {
    const rate = [{ importo: 50, stato: 'rimborsato', is_advance: true, scadenza: '2026-05-01' }];
    const s = derivePianoStats(rate, 50, now);
    expect(s.importoPagato).toBe(50);
    expect(s.residuo).toBe(0);
    expect(s.prossimaRata).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/utils/rientri.test.ts`
Expected: FAIL (module not found / functions undefined)

- [ ] **Step 3: Implement `src/utils/rientri.ts`**

```ts
import { parseISO, addMonths, format, isBefore, startOfDay } from 'date-fns';

export type Frequenza = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'personalizzata';

export interface RataInput { scadenza: string; importo: number; }

export function mesiPerFrequenza(f: Frequenza): number {
  switch (f) {
    case 'mensile': return 1;
    case 'bimestrale': return 2;
    case 'trimestrale': return 3;
    case 'semestrale': return 6;
    case 'annuale': return 12;
    default: return 0;
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function distribuisciImporti(importoTotale: number, n: number): number[] {
  if (n <= 0) return [];
  const base = r2(importoTotale / n);
  const arr = Array.from({ length: n }, () => base);
  const somma = r2(base * n);
  arr[n - 1] = r2(arr[n - 1] + (importoTotale - somma));
  return arr;
}

export function generateRate(opts: {
  importoTotale: number; numeroRate: number; frequenza: Frequenza; dataPrimaRata: string;
}): RataInput[] {
  const { importoTotale, numeroRate, frequenza, dataPrimaRata } = opts;
  const importi = distribuisciImporti(importoTotale, numeroRate);
  const step = mesiPerFrequenza(frequenza) || 1;
  const start = parseISO(dataPrimaRata);
  return importi.map((importo, k) => ({
    importo,
    scadenza: format(addMonths(start, k * step), 'yyyy-MM-dd'),
  }));
}

export interface RataLike {
  importo: number; stato?: string | null; is_advance?: boolean | null;
  scadenza: string; rata_numero?: number | null;
}
export interface PianoStats {
  totaleRate: number; ratePagate: number; importoPagato: number;
  residuo: number; percentuale: number; prossimaRata: RataLike | null; inRitardo: boolean;
}

const isPagata = (r: RataLike) => r.stato === 'pagato' || r.stato === 'rimborsato';

export function derivePianoStats(rate: RataLike[], importoTotale: number, now: Date = new Date()): PianoStats {
  const totaleRate = rate.length;
  const pagate = rate.filter(isPagata);
  const importoPagato = r2(pagate.reduce((s, r) => s + Number(r.importo), 0));
  const residuo = r2(importoTotale - importoPagato);
  const percentuale = importoTotale > 0 ? (importoPagato / importoTotale) * 100 : 0;
  const nonPagate = rate.filter(r => !isPagata(r)).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const prossimaRata = nonPagate[0] ?? null;
  const today = startOfDay(now);
  const inRitardo = nonPagate.some(r => isBefore(startOfDay(parseISO(r.scadenza)), today));
  return { totaleRate, ratePagate: pagate.length, importoPagato, residuo, percentuale, prossimaRata, inRitardo };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/utils/rientri.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/utils/rientri.ts src/utils/rientri.test.ts
git commit -m "feat(rientri): logica pura generazione e statistiche rate"
```

---

### Task 2: Migration DB + types

**Files:**
- Create: `supabase/migrations/20260619_piani_rientro.sql`
- Modify: `src/integrations/supabase/types.ts` (aggiungere table `piani_rientro` + colonne su `payments`)

**Interfaces:**
- Produces: table `piani_rientro` e colonne `payments.piano_rientro_id`, `payments.rata_numero`, `payments.consolidato_in_piano_id`.

- [ ] **Step 1: Scrivere la migration**

```sql
-- Piani di rientro: rateizzazione debiti/crediti
create table if not exists public.piani_rientro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gestione_id uuid not null references public.gestioni(id) on delete cascade,
  fornitore text not null,
  direzione text not null default 'uscita' check (direzione in ('uscita','entrata')),
  importo_totale numeric not null,
  numero_rate int not null check (numero_rate between 2 and 60),
  frequenza text not null,
  data_prima_rata date not null,
  stato text not null default 'attivo' check (stato in ('attivo','completato','annullato')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists piano_rientro_id uuid references public.piani_rientro(id) on delete set null,
  add column if not exists rata_numero int,
  add column if not exists consolidato_in_piano_id uuid references public.piani_rientro(id) on delete set null;

create index if not exists idx_payments_piano_rientro on public.payments(piano_rientro_id);
create index if not exists idx_payments_consolidato on public.payments(consolidato_in_piano_id);

alter table public.piani_rientro enable row level security;

create policy "piani_rientro_select_own" on public.piani_rientro for select using (auth.uid() = user_id);
create policy "piani_rientro_insert_own" on public.piani_rientro for insert with check (auth.uid() = user_id);
create policy "piani_rientro_update_own" on public.piani_rientro for update using (auth.uid() = user_id);
create policy "piani_rientro_delete_own" on public.piani_rientro for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Applicare la migration**

Applica su Supabase remoto via MCP `apply_migration` (name: `piani_rientro`) col corpo SQL sopra. Expected: success, nessun errore.

- [ ] **Step 3: Rigenerare i types**

Via MCP `generate_typescript_types`, sostituire il contenuto di `src/integrations/supabase/types.ts`. In alternativa, aggiungere a mano: il blocco table `piani_rientro` (Row/Insert/Update/Relationships) e i 3 campi nuovi a `payments` (Row/Insert/Update) + relationships verso `piani_rientro`.

- [ ] **Step 4: Verificare build types**

Run: `npx tsc --noEmit`
Expected: nessun errore relativo a `piani_rientro`/`payments`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260619_piani_rientro.sql src/integrations/supabase/types.ts
git commit -m "feat(rientri): migration tabella piani_rientro + colonne payments"
```

---

### Task 3: Hook `usePianiRientro`

**Files:**
- Create: `src/hooks/usePianiRientro.ts`

**Interfaces:**
- Consumes: `generateRate`, `derivePianoStats` da `src/utils/rientri.ts`; `supabase`.
- Produces:
  - `usePianiRientro()` → query key `['piani-rientro']`, ritorna piani con `rate` (payments collegate) e `stats` (da `derivePianoStats`) + `consolidate` (payments con `consolidato_in_piano_id`).
  - `useCreatePiano()` → mutation `{ piano, rate, consolidaIds }` (piano senza id; rate = `RataInput[]`; consolidaIds = uuid[]). Inserisce piano, poi inserisce le rate come `payments`, poi setta `consolidato_in_piano_id` sulle originali.
  - `useUpdatePiano()` → rigenera solo rate non pagate.
  - `useDeletePiano()` → cancella rate non pagate, scollega rate pagate e originali consolidate, elimina piano.

- [ ] **Step 1: Implementare l'hook**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { derivePianoStats, generateRate, type RataInput, type Frequenza } from '@/utils/rientri';

export interface PianoInput {
  gestione_id: string; fornitore: string; direzione: 'uscita' | 'entrata';
  importo_totale: number; numero_rate: number; frequenza: Frequenza;
  data_prima_rata: string; note?: string | null;
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  ['piani-rientro', 'payments', 'upcoming-payments', 'payment-stats', 'unified-expenses', 'cassa']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
};

export function usePianiRientro() {
  return useQuery({
    queryKey: ['piani-rientro'],
    queryFn: async () => {
      const { data: piani, error } = await supabase
        .from('piani_rientro').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (piani || []).map(p => p.id);
      let rate: any[] = [];
      let consolidate: any[] = [];
      if (ids.length) {
        const { data: r } = await supabase.from('payments').select('*').in('piano_rientro_id', ids);
        const { data: c } = await supabase.from('payments').select('*').in('consolidato_in_piano_id', ids);
        rate = r || []; consolidate = c || [];
      }
      return (piani || []).map(p => {
        const pr = rate.filter(x => x.piano_rientro_id === p.id)
          .sort((a, b) => (a.rata_numero ?? 0) - (b.rata_numero ?? 0));
        return {
          ...p,
          rate: pr,
          consolidate: consolidate.filter(x => x.consolidato_in_piano_id === p.id),
          stats: derivePianoStats(pr, Number(p.importo_totale)),
        };
      });
    },
  });
}

function rateToPayments(piano: any, pianoId: string, rate: RataInput[], userId: string) {
  return rate.map((r, i) => ({
    user_id: userId,
    gestione_id: piano.gestione_id,
    descrizione: `Rata ${i + 1}/${rate.length} — ${piano.fornitore}`,
    importo: r.importo,
    scadenza: r.scadenza,
    fornitore: piano.fornitore,
    categoria: 'altro',
    stato: 'in_attesa',
    ricorrenza_tipo: 'una_tantum',
    is_advance: piano.direzione === 'entrata',
    debtor_name: piano.direzione === 'entrata' ? piano.fornitore : null,
    piano_rientro_id: pianoId,
    rata_numero: i + 1,
  }));
}

export function useCreatePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ piano, rate, consolidaIds }: { piano: PianoInput; rate: RataInput[]; consolidaIds?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from('piani_rientro').insert({ ...piano, user_id: user!.id }).select().single();
      if (error) throw error;
      const rows = rateToPayments(piano, created.id, rate, user!.id);
      const { error: e2 } = await supabase.from('payments').insert(rows);
      if (e2) throw e2;
      if (consolidaIds?.length) {
        const { error: e3 } = await supabase.from('payments')
          .update({ consolidato_in_piano_id: created.id }).in('id', consolidaIds);
        if (e3) throw e3;
      }
      return created;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, piano, rateEsistenti }: { id: string; piano: PianoInput; rateEsistenti: any[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const pagate = rateEsistenti.filter(r => r.stato === 'pagato' || r.stato === 'rimborsato');
      const nonPagateIds = rateEsistenti.filter(r => !(r.stato === 'pagato' || r.stato === 'rimborsato')).map(r => r.id);
      // aggiorna intestazione piano
      const { error: eU } = await supabase.from('piani_rientro').update({ ...piano, updated_at: new Date().toISOString() }).eq('id', id);
      if (eU) throw eU;
      // elimina rate non pagate e rigenera il residuo
      if (nonPagateIds.length) {
        const { error } = await supabase.from('payments').delete().in('id', nonPagateIds);
        if (error) throw error;
      }
      const importoPagato = pagate.reduce((s, r) => s + Number(r.importo), 0);
      const residuo = Math.round((piano.importo_totale - importoPagato) * 100) / 100;
      const nDaGenerare = piano.numero_rate - pagate.length;
      if (residuo > 0 && nDaGenerare > 0) {
        const nuove = generateRate({
          importoTotale: residuo, numeroRate: nDaGenerare,
          frequenza: piano.frequenza, dataPrimaRata: piano.data_prima_rata,
        });
        const rows = rateToPayments(piano, id, nuove, user!.id)
          .map((row, i) => ({ ...row, rata_numero: pagate.length + i + 1, descrizione: `Rata ${pagate.length + i + 1}/${piano.numero_rate} — ${piano.fornitore}` }));
        const { error } = await supabase.from('payments').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePiano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // elimina rate non pagate
      await supabase.from('payments').delete()
        .eq('piano_rientro_id', id).in('stato', ['in_attesa', 'scaduto']);
      // scollega rate pagate e originali consolidate (restano per storico)
      await supabase.from('payments').update({ piano_rientro_id: null }).eq('piano_rientro_id', id);
      await supabase.from('payments').update({ consolidato_in_piano_id: null }).eq('consolidato_in_piano_id', id);
      const { error } = await supabase.from('piani_rientro').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
```

- [ ] **Step 2: Verificare build**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePianiRientro.ts
git commit -m "feat(rientri): hook usePianiRientro (CRUD + generazione rate)"
```

---

### Task 4: Dialog `PianoRientroDialog`

**Files:**
- Create: `src/components/PianoRientroDialog.tsx`

**Interfaces:**
- Consumes: `useCreatePiano`, `useUpdatePiano`, `PianoInput`; `useGestioni`; `generateRate`, `distribuisciImporti`, `mesiPerFrequenza`, `Frequenza`.
- Produces: `<PianoRientroDialog open onOpenChange piano?={existing} prefill?={{ fornitore?, importoTotale?, gestioneId?, consolidaIds? }} />`.

Riproduce il dialog dello screenshot: Fornitore (input testo/select), Importo totale, Numero rate (2–60), Frequenza, Data prima rata, checkbox "Importi personalizzati per rata" → tabella (# · Data scadenza · Importo) + "Distribuisci" + indicatore *Somma rate / atteso*, Note, footer "Annulla" / "Crea piano e genera rate" (o "Salva modifiche").

- [ ] **Step 1: Implementare il componente**

```tsx
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
      setNumeroRate(String(piano.numero_rate)); setFrequenza(piano.frequenza);
      setDataPrimaRata(piano.data_prima_rata); setNote(piano.note || ''); setCustom(false); setRighe([]);
    } else {
      setGestioneId(prefill?.gestioneId || gestioni[0]?.id || '');
      setFornitore(prefill?.fornitore || ''); setDirezione(prefill?.direzione || 'uscita');
      setImportoTotale(prefill?.importoTotale ? String(prefill.importoTotale) : '');
      setNumeroRate('6'); setFrequenza('mensile'); setDataPrimaRata(''); setNote(''); setCustom(false); setRighe([]);
    }
  }, [open, piano, prefill, gestioni]);

  // sincronizza la tabella custom con i parametri
  useEffect(() => {
    if (!custom) return;
    const tot = parseFloat(importoTotale) || 0;
    const n = Math.max(2, Math.min(60, parseInt(numeroRate) || 0));
    if (!dataPrimaRata) { setRighe(Array.from({ length: n }, () => ({ scadenza: '', importo: '0' }))); return; }
    const base = generateRate({ importoTotale: tot, numeroRate: n, frequenza, dataPrimaRata });
    setRighe(base.map(r => ({ scadenza: r.scadenza, importo: String(r.importo) })));
  }, [custom]); // eslint-disable-line

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
                <SelectContent>{gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Importi personalizzati per rata</Label>
                  <p className="text-xs text-muted-foreground">Permetti rate di importi diversi (es. acconto più alto e poi rate mensili)</p>
                </div>
                <Switch checked={custom} onCheckedChange={setCustom} />
              </div>
              {custom && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
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
```

- [ ] **Step 2: Verificare build**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/components/PianoRientroDialog.tsx
git commit -m "feat(rientri): dialog creazione/modifica piano con importi personalizzati"
```

---

### Task 5: Tab "Rientri" + card piani in Expenses + esclusione consolidate

**Files:**
- Modify: `src/pages/Expenses.tsx`
- Create: `src/components/RientriTab.tsx`

**Interfaces:**
- Consumes: `usePianiRientro`, `useDeletePiano`, `PianoRientroDialog`, `derivePianoStats` (già dentro la query).
- Produces: nuovo `<TabsTrigger value="rientri">` e `<TabsContent value="rientri">` che monta `<RientriTab />`.

- [ ] **Step 1: Creare `RientriTab.tsx`**

```tsx
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

  const attivi = piani.filter((p: any) => p.stato === 'attivo');
  const inRitardo = attivi.filter((p: any) => p.stats.inRitardo).length;
  const residuoTotale = attivi.reduce((s: number, p: any) => s + p.stats.residuo, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-primary" />Archivio Rientri</h3>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nuovo piano di rientro</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Piani attivi</p><p className="text-2xl font-bold">{attivi.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">In ritardo</p><p className={`text-2xl font-bold ${inRitardo ? 'text-red-600' : ''}`}>{inRitardo}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Residuo totale</p><p className="text-2xl font-bold">€ {fmt(residuoTotale)}</p></CardContent></Card>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Caricamento…</p>}
      {!isLoading && piani.length === 0 && <p className="text-muted-foreground text-sm">Nessun piano di rientro. Creane uno con il pulsante in alto.</p>}

      <div className="space-y-3">
        {piani.map((p: any) => {
          const s = p.stats;
          const next = s.prossimaRata;
          const gg = next ? differenceInCalendarDays(parseISO(next.scadenza), new Date()) : null;
          const isOpen = expanded === p.id;
          return (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.fornitore}</span>
                      <Badge variant={p.stato === 'attivo' ? 'default' : 'secondary'}>{p.stato}</Badge>
                      <Badge variant="outline">{p.direzione === 'entrata' ? 'Credito' : 'Debito'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.ratePagate}/{s.totaleRate} rate — € {fmt(s.importoPagato)} pagati</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€ {fmt(Number(p.importo_totale))}</p>
                    <p className="text-xs text-muted-foreground">Residuo € {fmt(s.residuo)}</p>
                  </div>
                </div>
                <Progress value={s.percentuale} />
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <span>{FREQ_LABEL[p.frequenza]} · dal {format(parseISO(p.data_prima_rata), 'd MMM yyyy', { locale: it })}</span>
                  {next && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />Prossima: {format(parseISO(next.scadenza), 'd MMM yyyy', { locale: it })} · € {fmt(Number(next.importo))} {gg !== null && <span className={gg < 0 ? 'text-red-600' : ''}>· {gg < 0 ? `${-gg}gg fa` : `tra ${gg}gg`}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : p.id)}>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Rate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Eliminare il piano? Le rate non pagate verranno rimosse.')) deletePiano.mutate(p.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
                {isOpen && (
                  <div className="border-t pt-2 space-y-1">
                    {p.rate.map((r: any) => (
                      <div key={r.id} className="flex justify-between text-xs">
                        <span>Rata {r.rata_numero} · {format(parseISO(r.scadenza), 'd MMM yyyy', { locale: it })}</span>
                        <span className={r.stato === 'pagato' || r.stato === 'rimborsato' ? 'text-emerald-600' : ''}>€ {fmt(Number(r.importo))} {(r.stato === 'pagato' || r.stato === 'rimborsato') ? '✓' : ''}</span>
                      </div>
                    ))}
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

      <PianoRientroDialog open={dialogOpen} onOpenChange={setDialogOpen} piano={editing} />
    </div>
  );
}
```

- [ ] **Step 2: Montare la tab in `Expenses.tsx`**

In `Expenses.tsx`: importare `RientriTab` (`import RientriTab from '@/components/RientriTab';`). Aggiungere alla `TabsList` un trigger `<TabsTrigger value="rientri">🔁 Rientri</TabsTrigger>` accanto agli altri, e in fondo ai `TabsContent`:

```tsx
<TabsContent value="rientri"><RientriTab /></TabsContent>
```

- [ ] **Step 3: Escludere le spese consolidate dagli scadenzari**

In `Expenses.tsx`, nel punto in cui si calcola `filtered`/`ordinary`/`advancesAll` (intorno a riga 495–508), escludere le righe con `consolidato_in_piano_id` valorizzato. Esempio: nel filtro principale aggiungere `&& !ex.consolidato_in_piano_id`.

- [ ] **Step 4: Verificare build + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: nessun errore TS, tutti i test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Expenses.tsx src/components/RientriTab.tsx
git commit -m "feat(rientri): tab Rientri con card piani ed esclusione spese consolidate"
```

---

### Task 6: Consolidamento da lista spese (selezione)

**Files:**
- Modify: `src/pages/Expenses.tsx`

**Interfaces:**
- Consumes: `PianoRientroDialog` con `prefill={{ fornitore, importoTotale, gestioneId, consolidaIds }}`.

- [ ] **Step 1: Aggiungere modalità selezione**

In `Expenses.tsx` aggiungere stato `selezione: Set<string>` e un toggle "Consolida in piano". Quando attivo, mostrare una checkbox su ogni riga spesa ordinaria non ancora consolidata. Una barra in cima mostra "N selezionate · € totale" con bottone "Crea piano di rientro" che apre `PianoRientroDialog` con:
- `importoTotale` = somma importi selezionati
- `fornitore` = fornitore comune se uniforme, altrimenti vuoto
- `gestioneId` = gestione comune se uniforme
- `consolidaIds` = array degli id selezionati

```tsx
// stato
const [selMode, setSelMode] = useState(false);
const [sel, setSel] = useState<Set<string>>(new Set());
const [consolidaPrefill, setConsolidaPrefill] = useState<any>(null);
const toggleSel = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

const apriConsolida = () => {
  const items = ordinary.filter(e => sel.has(e.id));
  if (!items.length) return;
  const tot = items.reduce((s, e) => s + Number(e.importo), 0);
  const forn = items.every(e => e.fornitore === items[0].fornitore) ? items[0].fornitore : '';
  const gest = items.every(e => e.gestione_id === items[0].gestione_id) ? items[0].gestione_id : undefined;
  setConsolidaPrefill({ fornitore: forn, importoTotale: tot, gestioneId: gest, consolidaIds: items.map(e => e.id) });
};
```

Montare un secondo `<PianoRientroDialog open={!!consolidaPrefill} onOpenChange={(o)=>{ if(!o){ setConsolidaPrefill(null); setSel(new Set()); setSelMode(false);} }} prefill={consolidaPrefill} />`.

Aggiungere il bottone toggle "Consolida" nella toolbar e, sulle righe spese ordinarie (componente che renderizza `ordinary`), una checkbox condizionata a `selMode` che chiama `toggleSel(ex.id)`.

- [ ] **Step 2: Verificare build**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Expenses.tsx
git commit -m "feat(rientri): consolidamento spese selezionate in un piano di rientro"
```

---

### Task 7: Verifica finale, lint e push

- [ ] **Step 1: Lint + types + test**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: nessun errore TS, test verdi, lint pulito (o solo warning preesistenti).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Push su main**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Modello dati (`piani_rientro` + colonne payments) → Task 2 ✓
- Generazione rate (frequenza, equo, personalizzati, Distribuisci) → Task 1 + Task 4 ✓
- Direzione debiti/crediti via is_advance → Task 3 (`rateToPayments`) ✓
- Tab Rientri + card EdilCRM-style + KPI → Task 5 ✓
- Dialog come screenshot → Task 4 ✓
- Doppio ingresso: custom (Task 4/5) + consolidamento (Task 6) ✓
- Modifica → rigenera solo rate non pagate → Task 3 (`useUpdatePiano`) ✓
- Esclusione spese consolidate dagli scadenzari → Task 5 Step 3 ✓
- Push su main → Task 7 ✓

**Placeholder scan:** nessun TBD/TODO; codice completo per util, hook, dialog, tab. I punti di innesto in `Expenses.tsx` (Task 5 Step 2/3, Task 6) sono descritti con codice e riferimenti di riga perché il file è grande (1144 righe) e va modificato chirurgicamente.

**Type consistency:** `generateRate`/`distribuisciImporti`/`derivePianoStats`/`PianoInput`/`RataInput` usati coerentemente tra Task 1, 3, 4. `is_advance`/`stato` coerenti con lo schema `payments` esistente.
