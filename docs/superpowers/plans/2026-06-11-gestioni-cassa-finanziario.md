# Gestioni, Cassa & Migliorie Finanziario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere ricerca e fix scadenze in Spese/Incassi, e un sistema di gestioni (2 gruppi fissi) con conti, saldi di cassa, giroconti, pagina Cassa ed estratto conto PDF.

**Architecture:** Migration Supabase introduce `gestioni`/`conti`/`giroconti` e colonne `gestione_id`/`conto_id`. Logica pura (bucket scadenze, calcolo cassa) isolata in `src/utils` con test vitest. UI in React/shadcn aggiorna Spese/Incassi e aggiunge pagina Cassa. PDF con `@react-pdf/renderer`.

**Tech Stack:** React 18, Vite, TypeScript, shadcn/ui, TanStack Query, Supabase, date-fns, @react-pdf/renderer, vitest (nuovo, per logica pura).

**Riferimento spec:** `docs/superpowers/specs/2026-06-11-gestioni-cassa-finanziario-design.md`

---

## File Structure

**Nuovi file**
- `supabase/migrations/20260611_gestioni_cassa.sql` — schema + seed.
- `src/utils/scadenze.ts` — bucket scadenze (logica pura, condivisa Spese/Incassi).
- `src/utils/scadenze.test.ts` — test vitest.
- `src/utils/cassa.ts` — calcolo saldi (logica pura).
- `src/utils/cassa.test.ts` — test vitest.
- `src/hooks/useGestioni.ts`, `src/hooks/useConti.ts`, `src/hooks/useGiroconti.ts`, `src/hooks/useCassa.ts`.
- `src/pages/Cassa.tsx` — pagina cassa.
- `src/components/ContoDialog.tsx`, `src/components/GirocontoDialog.tsx`.
- `src/components/EstrattoContoPDF.tsx` — documento PDF + helper download.
- `vitest.config.ts`.

**File modificati**
- `package.json` — devDep vitest + script `test`.
- `src/pages/Expenses.tsx` — ricerca, fix/raggruppamento scadenze, filtro gestione, scelta conto.
- `src/components/Revenue.tsx` — ricerca, fix/raggruppamento scadenze, filtro gestione, scelta conto.
- `src/components/AddPropertyDialog.tsx` — campo gestione.
- `src/pages/MobileProperties.tsx` (o relativo form veicolo) — campo gestione.
- `src/components/Sidebar.tsx` — voce "Cassa".
- `src/App.tsx` — route `/cassa`.
- `src/integrations/supabase/types.ts` — rigenerato dopo migration.

---

## Task 0: Setup vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Installa vitest**

Run: `npm i -D vitest`
Expected: vitest in devDependencies.

- [ ] **Step 2: Crea `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 3: Aggiungi script test in `package.json`**

In `"scripts"` aggiungi: `"test": "vitest run"`.

- [ ] **Step 4: Verifica**

Run: `npx vitest run`
Expected: "No test files found" (nessun test ancora) — esce senza errori di config.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: setup vitest per logica pura"
```

---

## Task 1: Migration DB — gestioni, conti, giroconti, colonne

**Files:**
- Create: `supabase/migrations/20260611_gestioni_cassa.sql`
- Modify: `src/integrations/supabase/types.ts` (rigenerato)

- [ ] **Step 1: Scrivi la migration**

File `supabase/migrations/20260611_gestioni_cassa.sql`:

```sql
-- Gestioni (2 gruppi fissi)
create table if not exists public.gestioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text,
  created_at timestamptz default now()
);

-- Conti / casse per gestione
create table if not exists public.conti (
  id uuid primary key default gen_random_uuid(),
  gestione_id uuid not null references public.gestioni(id) on delete cascade,
  nome text not null,
  tipo text not null default 'banca' check (tipo in ('contanti','banca')),
  saldo_iniziale numeric not null default 0,
  data_apertura date not null default current_date,
  user_id uuid,
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- Giroconti tra conti
create table if not exists public.giroconti (
  id uuid primary key default gen_random_uuid(),
  conto_from uuid not null references public.conti(id) on delete cascade,
  conto_to uuid not null references public.conti(id) on delete cascade,
  importo numeric not null,
  data date not null default current_date,
  descrizione text,
  user_id uuid,
  created_at timestamptz default now()
);

-- Colonne nuove
alter table public.properties_real    add column if not exists gestione_id uuid references public.gestioni(id);
alter table public.properties_mobile  add column if not exists gestione_id uuid references public.gestioni(id);
alter table public.payments           add column if not exists conto_id uuid references public.conti(id);
alter table public.tenant_payments    add column if not exists conto_id uuid references public.conti(id);

-- Seed 2 gestioni fisse (idempotente)
insert into public.gestioni (nome, colore)
select 'Io & Mamma', 'blue'
where not exists (select 1 from public.gestioni where nome = 'Io & Mamma');
insert into public.gestioni (nome, colore)
select 'Nonni', 'orange'
where not exists (select 1 from public.gestioni where nome = 'Nonni');

-- RLS coerente con le altre tabelle
alter table public.gestioni  enable row level security;
alter table public.conti     enable row level security;
alter table public.giroconti enable row level security;

create policy "gestioni read"  on public.gestioni  for select using (true);
create policy "conti all"      on public.conti      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "giroconti all"  on public.giroconti  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Applica la migration**

Usa il tool MCP `mcp__claude_ai_supabase__apply_migration` con name `gestioni_cassa` e il contenuto SQL sopra (oppure `supabase db push` se in locale). Verifica con `mcp__claude_ai_supabase__list_tables` che `gestioni`, `conti`, `giroconti` esistano e che `gestioni` abbia 2 righe (`execute_sql: select count(*) from gestioni`).

Expected: 3 tabelle nuove, 2 righe in gestioni.

- [ ] **Step 3: Rigenera i types**

Usa `mcp__claude_ai_supabase__generate_typescript_types` e sovrascrivi `src/integrations/supabase/types.ts`. Verifica che compaiano `gestioni`, `conti`, `giroconti` e i campi `gestione_id`/`conto_id`.

- [ ] **Step 4: Verifica build types**

Run: `npm run build`
Expected: build OK (nessun errore di tipo legato alle nuove tabelle).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611_gestioni_cassa.sql src/integrations/supabase/types.ts
git commit -m "feat(db): gestioni, conti, giroconti + colonne gestione_id/conto_id"
```

---

## Task 2: Logica pura bucket scadenze (+ test)

Estrae la logica di bucketing condivisa. `today` viene incluso in "questa settimana"; `thisWeek` è suddiviso per giorno.

**Files:**
- Create: `src/utils/scadenze.ts`
- Test: `src/utils/scadenze.test.ts`

- [ ] **Step 1: Scrivi il test (fallisce)**

`src/utils/scadenze.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bucketByScadenza } from './scadenze';

const mk = (id: string, scadenza: string, stato = 'da_pagare') => ({ id, scadenza, stato });

describe('bucketByScadenza', () => {
  const now = new Date('2026-06-11T14:00:00'); // giovedì

  it('una scadenza di OGGI finisce in thisWeek, mai persa', () => {
    const r = bucketByScadenza([mk('a', '2026-06-11')], now);
    expect(r.overdue.map(x => x.id)).toEqual([]);
    const todayIds = r.thisWeek.flatMap(g => g.items.map(i => i.id));
    expect(todayIds).toContain('a');
  });

  it('una scadenza passata (non oggi) finisce in overdue', () => {
    const r = bucketByScadenza([mk('b', '2026-06-01')], now);
    expect(r.overdue.map(x => x.id)).toEqual(['b']);
  });

  it('thisWeek è suddiviso per giorno, oggi in cima', () => {
    const r = bucketByScadenza([mk('c', '2026-06-13'), mk('d', '2026-06-11')], now);
    expect(r.thisWeek[0].date).toBe('2026-06-11');
    expect(r.thisWeek[0].isToday).toBe(true);
    expect(r.thisWeek.map(g => g.date)).toEqual(['2026-06-11', '2026-06-13']);
  });

  it('oltre 7 giorni va in thisMonth, oltre 30 in later', () => {
    const r = bucketByScadenza([mk('e', '2026-06-25'), mk('f', '2026-08-01')], now);
    expect(r.thisMonth.map(x => x.id)).toEqual(['e']);
    expect(r.later.map(x => x.id)).toEqual(['f']);
  });

  it('le voci pagate vanno in paid', () => {
    const r = bucketByScadenza([mk('g', '2026-06-01', 'pagato')], now);
    expect(r.paid.map(x => x.id)).toEqual(['g']);
  });
});
```

- [ ] **Step 2: Esegui, deve fallire**

Run: `npx vitest run src/utils/scadenze.test.ts`
Expected: FAIL ("bucketByScadenza is not a function").

- [ ] **Step 3: Implementa `src/utils/scadenze.ts`**

```ts
import { isPast, isToday, parseISO, addDays, isBefore, format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

export interface ScadenzaItem { scadenza: string; stato?: string | null; [k: string]: any; }
export interface DayGroup<T> { date: string; label: string; isToday: boolean; items: T[]; }
export interface Buckets<T> {
  overdue: T[];
  thisWeek: DayGroup<T>[];
  thisMonth: T[];
  later: T[];
  paid: T[];
}

// `getDate` permette di usarlo sia con `scadenza` (spese) sia con `data_scadenza` (incassi)
export function bucketByScadenza<T extends Record<string, any>>(
  items: T[],
  now: Date = new Date(),
  getDate: (i: T) => string = (i) => i.scadenza,
): Buckets<T> {
  const in7 = addDays(now, 7);
  const in30 = addDays(now, 30);

  const paid = items.filter(i => i.stato === 'pagato');
  const open = items.filter(i => i.stato !== 'pagato');

  const overdue: T[] = [];
  const week: T[] = [];
  const month: T[] = [];
  const later: T[] = [];

  for (const i of open) {
    const d = parseISO(getDate(i));
    if (isPast(d) && !isToday(d)) { overdue.push(i); continue; }
    // oggi o futuro
    if (isToday(d) || isBefore(d, in7)) { week.push(i); continue; }
    if (isBefore(d, in30)) { month.push(i); continue; }
    later.push(i);
  }

  // raggruppa "questa settimana" per giorno
  const byDay: Record<string, T[]> = {};
  for (const i of week) {
    const key = format(parseISO(getDate(i)), 'yyyy-MM-dd');
    (byDay[key] ||= []).push(i);
  }
  const thisWeek: DayGroup<T>[] = Object.keys(byDay).sort().map(date => {
    const d = parseISO(date);
    const today = isToday(d);
    const label = (today ? 'Oggi — ' : '') + format(d, 'EEEE d MMM', { locale: itLocale });
    return { date, label: label.charAt(0).toUpperCase() + label.slice(1), isToday: today, items: byDay[date] };
  });

  return { overdue, thisWeek, thisMonth: month, later, paid };
}
```

- [ ] **Step 4: Esegui, deve passare**

Run: `npx vitest run src/utils/scadenze.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/scadenze.ts src/utils/scadenze.test.ts
git commit -m "feat: util bucket scadenze con fix oggi + raggruppamento per giorno"
```

---

## Task 3: Applica scadenze + ricerca in Expenses.tsx

**Files:**
- Modify: `src/pages/Expenses.tsx`

- [ ] **Step 1: Importa util e aggiungi stato ricerca**

In testa, importa: `import { bucketByScadenza } from '@/utils/scadenze';`
Dopo gli altri `useState`, aggiungi: `const [search, setSearch] = useState('');`

- [ ] **Step 2: Aggiungi filtro testo nel `filtered` (useMemo)**

Dentro `expenses.filter(...)` aggiungi, prima del `return true;`:

```ts
if (search.trim()) {
  const q = search.toLowerCase();
  const hay = [
    ex.descrizione, ex.fornitore, ex.note, ex.debtor_name,
    ex.properties_real?.nome, ex.properties_mobile?.veicolo,
    String(ex.importo),
  ].filter(Boolean).join(' ').toLowerCase();
  if (!hay.includes(q)) return false;
}
```
Aggiungi `search` alle dipendenze del `useMemo`.

- [ ] **Step 3: Sostituisci il calcolo dei bucket ordinari**

Sostituisci le righe che calcolano `overdue/upcoming/thisWeek/thisMonth/later` (sezione "sections") con:

```ts
const ordinaryBuckets = bucketByScadenza(ordinary, new Date(), (e) => e.scadenza);
const overdue   = ordinaryBuckets.overdue;
const thisWeek  = ordinaryBuckets.thisWeek;   // DayGroup[]
const thisMonth = ordinaryBuckets.thisMonth;
const later     = ordinaryBuckets.later;
const paid      = ordinaryBuckets.paid;
const upcoming  = [...thisWeek.flatMap(g => g.items), ...thisMonth, ...later];
```
(`ordinary`/`advancesAll` restano come prima.)

- [ ] **Step 4: Rendi "Questa settimana" per giorno**

Nel blocco `{thisWeek.length > 0 && (...)}` della tab "upcoming", sostituisci la singola Card con un map dei DayGroup:

```tsx
{thisWeek.length > 0 && thisWeek.map(group => (
  <div key={group.date}>
    <p className="text-sm sm:text-xs font-bold uppercase tracking-wider text-red-600 mb-2 px-1">
      {group.isToday ? '⚡ ' : '📌 '}{group.label}
    </p>
    <Card>
      <CardContent className="p-0 divide-y">
        {group.items.map(ex => (
          <ExpenseRow key={ex.id} exp={ex}
            onPaga={() => { setConfirmTarget(ex); setConfirmDate(format(new Date(), 'yyyy-MM-dd')); setConfirmMethod('bonifico'); setConfirmNote(''); }}
            onEdit={() => openEdit(ex)}
            onDelete={() => { if (confirm('Eliminare?')) deleteExpense.mutate(ex.id); }}
          />
        ))}
      </CardContent>
    </Card>
  </div>
))}
```

- [ ] **Step 5: Aggiungi la barra di ricerca nell'header**

Dentro `<PageHeader>` come primo elemento del div dei controlli:

```tsx
<Input placeholder="Cerca spese…" value={search} onChange={e => setSearch(e.target.value)}
  className="h-9 sm:h-8 text-xs w-full sm:w-[180px] bg-white" />
```

- [ ] **Step 6: Verifica**

Run: `npm run build` → Expected: OK.
Manuale (app live): inserisci una spesa con scadenza = oggi → appare in "Questa settimana" sotto "Oggi". La ricerca filtra in tutte le tab.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Expenses.tsx
git commit -m "feat(spese): ricerca + fix scadenze oggi + raggruppamento per giorno"
```

---

## Task 4: Applica scadenze + ricerca in Revenue.tsx

**Files:**
- Modify: `src/components/Revenue.tsx`

- [ ] **Step 1: Importa util e stato ricerca**

`import { bucketByScadenza } from '@/utils/scadenze';`
`const [search, setSearch] = useState('');`

- [ ] **Step 2: Filtro testo nel `filtered`**

Dentro `revenues.filter(...)` prima di `return true;`:

```ts
if (search.trim()) {
  const q = search.toLowerCase();
  const hay = [
    r.bookings?.nome_ospite, r.bookings?.properties_real?.nome,
    r.description, r.notes, String(r.importo),
  ].filter(Boolean).join(' ').toLowerCase();
  if (!hay.includes(q)) return false;
}
```
Aggiungi `search` alle dipendenze.

- [ ] **Step 3: Sostituisci bucket**

Sostituisci `overdue/upcoming/thisWeek/thisMonth/later/paid` con:

```ts
const buckets   = bucketByScadenza(filtered, new Date(), (r) => r.data_scadenza);
const overdue   = buckets.overdue;
const thisWeek  = buckets.thisWeek;
const thisMonth = buckets.thisMonth;
const later     = buckets.later;
const paid      = buckets.paid;
const upcoming  = [...thisWeek.flatMap(g => g.items), ...thisMonth, ...later];
```

- [ ] **Step 4: "Questa settimana" per giorno**

Come Task 3 Step 4 ma con `RevenueRow` e gli handler già presenti (`onIncassa`, `onEdit`, `onDelete`, `onCalendar`):

```tsx
{thisWeek.length > 0 && thisWeek.map(group => (
  <div key={group.date}>
    <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2 px-1">
      {group.isToday ? '⚡ ' : '📌 '}{group.label}
    </p>
    <Card>
      <CardContent className="p-0 divide-y">
        {group.items.map(r => (
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
))}
```

- [ ] **Step 5: Barra di ricerca nell'header**

Primo elemento dei controlli in `<PageHeader>`:

```tsx
<Input placeholder="Cerca incassi…" value={search} onChange={e => setSearch(e.target.value)}
  className="h-9 sm:h-8 text-xs w-[150px] sm:w-[180px] bg-white" />
```
(importa `Input` se non già importato.)

- [ ] **Step 6: Verifica**

Run: `npm run build` → OK. Manuale: incasso con scadenza oggi appare in "Questa settimana / Oggi"; ricerca funziona.

- [ ] **Step 7: Commit**

```bash
git add src/components/Revenue.tsx
git commit -m "feat(incassi): ricerca + fix scadenze oggi + raggruppamento per giorno"
```

---

## Task 5: Hooks gestioni / conti / giroconti

**Files:**
- Create: `src/hooks/useGestioni.ts`, `src/hooks/useConti.ts`, `src/hooks/useGiroconti.ts`

- [ ] **Step 1: `useGestioni.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGestioni() {
  return useQuery({
    queryKey: ['gestioni'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gestioni').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}
```

- [ ] **Step 2: `useConti.ts` (lista + create + update + archive)**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useConti() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['conti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conti').select('*').eq('archived', false).order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const createConto = useMutation({
    mutationFn: async (c: { gestione_id: string; nome: string; tipo: string; saldo_iniziale: number; data_apertura: string; }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('conti').insert({ ...c, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conti'] }),
  });

  const updateConto = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; nome?: string; saldo_iniziale?: number; data_apertura?: string; archived?: boolean; }) => {
      const { error } = await supabase.from('conti').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conti'] }),
  });

  return { ...list, createConto, updateConto };
}
```

- [ ] **Step 3: `useGiroconti.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGiroconti() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['giroconti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('giroconti').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const createGiroconto = useMutation({
    mutationFn: async (g: { conto_from: string; conto_to: string; importo: number; data: string; descrizione?: string; }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('giroconti').insert({ ...g, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['giroconti'] }); qc.invalidateQueries({ queryKey: ['conti'] }); },
  });
  return { ...list, createGiroconto };
}
```

- [ ] **Step 4: Verifica**

Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGestioni.ts src/hooks/useConti.ts src/hooks/useGiroconti.ts
git commit -m "feat: hooks gestioni, conti, giroconti"
```

---

## Task 6: Logica pura calcolo cassa (+ test) + useCassa

Saldo conto = saldo_iniziale + incassi pagati − spese pagate + giroconti netti, contando solo i movimenti con data ≥ data_apertura.

**Files:**
- Create: `src/utils/cassa.ts`, `src/utils/cassa.test.ts`, `src/hooks/useCassa.ts`

- [ ] **Step 1: Test (fallisce)**

`src/utils/cassa.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { saldoConto } from './cassa';

const conto = { id: 'c1', saldo_iniziale: 1000, data_apertura: '2026-06-01' };

describe('saldoConto', () => {
  it('parte dal saldo iniziale senza movimenti', () => {
    expect(saldoConto(conto, { incassi: [], spese: [], giroconti: [] })).toBe(1000);
  });

  it('somma incassi pagati e sottrae spese pagate dopo data_apertura', () => {
    const r = saldoConto(conto, {
      incassi: [{ conto_id: 'c1', importo: 500, payment_date: '2026-06-05', stato: 'pagato' }],
      spese:   [{ conto_id: 'c1', importo: 200, data_pagamento: '2026-06-06', stato: 'pagato' }],
      giroconti: [],
    });
    expect(r).toBe(1300);
  });

  it('ignora movimenti prima di data_apertura e non pagati', () => {
    const r = saldoConto(conto, {
      incassi: [
        { conto_id: 'c1', importo: 999, payment_date: '2026-05-01', stato: 'pagato' },
        { conto_id: 'c1', importo: 999, payment_date: '2026-06-10', stato: 'da_pagare' },
      ],
      spese: [], giroconti: [],
    });
    expect(r).toBe(1000);
  });

  it('applica i giroconti in entrata e uscita', () => {
    const r = saldoConto(conto, {
      incassi: [], spese: [],
      giroconti: [
        { conto_from: 'c1', conto_to: 'cX', importo: 100, data: '2026-06-07' },
        { conto_from: 'cY', conto_to: 'c1', importo: 50,  data: '2026-06-08' },
      ],
    });
    expect(r).toBe(950);
  });
});
```

- [ ] **Step 2: Esegui, fallisce**

Run: `npx vitest run src/utils/cassa.test.ts` → FAIL.

- [ ] **Step 3: Implementa `src/utils/cassa.ts`**

```ts
export interface ContoBase { id: string; saldo_iniziale: number; data_apertura: string; }
export interface Incasso { conto_id?: string | null; importo: number; payment_date?: string | null; stato?: string | null; }
export interface Spesa   { conto_id?: string | null; importo: number; data_pagamento?: string | null; stato?: string | null; }
export interface Giroconto { conto_from: string; conto_to: string; importo: number; data: string; }

export function saldoConto(
  conto: ContoBase,
  mov: { incassi: Incasso[]; spese: Spesa[]; giroconti: Giroconto[] },
): number {
  const apertura = conto.data_apertura;
  const after = (d?: string | null) => !!d && d >= apertura;

  let saldo = Number(conto.saldo_iniziale) || 0;

  for (const i of mov.incassi)
    if (i.conto_id === conto.id && i.stato === 'pagato' && after(i.payment_date)) saldo += Number(i.importo);

  for (const s of mov.spese)
    if (s.conto_id === conto.id && s.stato === 'pagato' && after(s.data_pagamento)) saldo -= Number(s.importo);

  for (const g of mov.giroconti) {
    if (!after(g.data)) continue;
    if (g.conto_to === conto.id)   saldo += Number(g.importo);
    if (g.conto_from === conto.id) saldo -= Number(g.importo);
  }
  return saldo;
}
```

- [ ] **Step 4: Esegui, passa**

Run: `npx vitest run src/utils/cassa.test.ts` → PASS (4 test).

- [ ] **Step 5: `src/hooks/useCassa.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { saldoConto } from '@/utils/cassa';

export function useCassa() {
  return useQuery({
    queryKey: ['cassa'],
    queryFn: async () => {
      const [{ data: conti }, { data: incassi }, { data: spese }, { data: giroconti }] = await Promise.all([
        supabase.from('conti').select('*').eq('archived', false),
        supabase.from('tenant_payments').select('conto_id, importo, payment_date, stato'),
        supabase.from('payments').select('conto_id, importo, data_pagamento, stato'),
        supabase.from('giroconti').select('conto_from, conto_to, importo, data'),
      ]);
      const mov = { incassi: incassi || [], spese: spese || [], giroconti: giroconti || [] };
      return (conti || []).map(c => ({ ...c, saldo: saldoConto(c as any, mov) }));
    },
  });
}
```

- [ ] **Step 6: Verifica + Commit**

Run: `npm run build` → OK.
```bash
git add src/utils/cassa.ts src/utils/cassa.test.ts src/hooks/useCassa.ts
git commit -m "feat: calcolo saldi cassa (logica pura testata) + useCassa"
```

---

## Task 7: Campo gestione nei form proprietà

**Files:**
- Modify: `src/components/AddPropertyDialog.tsx`
- Modify: form veicolo (cerca in `src/pages/MobileProperties.tsx` il dialog di creazione/modifica; applica lo stesso pattern al payload con `gestione_id`)

- [ ] **Step 1: AddPropertyDialog — import + stato**

Importa `import { useGestioni } from '@/hooks/useGestioni';` e nel componente: `const { data: gestioni = [] } = useGestioni();`
Aggiungi `gestione_id: ''` allo stato del form e includilo nel payload `insert/update` su `properties_real`.

- [ ] **Step 2: Select gestione nel form**

Aggiungi (vicino agli altri campi):

```tsx
<div className="grid gap-1.5">
  <Label>Gestione</Label>
  <Select value={form.gestione_id} onValueChange={v => setForm(f => ({ ...f, gestione_id: v }))}>
    <SelectTrigger><SelectValue placeholder="Seleziona gestione…" /></SelectTrigger>
    <SelectContent>
      {gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 3: Stesso campo nel form veicolo** (payload su `properties_mobile.gestione_id`).

- [ ] **Step 4: Verifica + Commit**

Run: `npm run build` → OK. Manuale: creando/modificando una proprietà puoi assegnare la gestione.
```bash
git add src/components/AddPropertyDialog.tsx src/pages/MobileProperties.tsx
git commit -m "feat(proprieta): campo gestione su immobili e veicoli"
```

---

## Task 8: Filtro gestione + scelta conto in Spese

**Files:**
- Modify: `src/pages/Expenses.tsx`

- [ ] **Step 1: Import e dati**

`import { useGestioni } from '@/hooks/useGestioni';`
`import { useConti } from '@/hooks/useConti';`
Nel componente: `const { data: gestioni = [] } = useGestioni();` e `const { data: conti = [] } = useConti();`
Stato filtro: `const [filterGestione, setFilterGestione] = useState('all');`

> Le spese hanno `property_real_id` / `property_mobile_id`. Per filtrare per gestione servono le gestioni delle proprietà. La query `realProperties` (`usePropertiesReal`) e `mobileProperties` devono includere `gestione_id`. Verifica/aggiorna le `select` per includerlo (in `useProperties.ts` aggiungi `gestione_id` allo `select`, e nella query `mobile-properties` di questo file aggiungi `gestione_id`).

- [ ] **Step 2: Applica il filtro gestione nel `filtered`**

```ts
if (filterGestione !== 'all') {
  const realIds = new Set(realProperties.filter(p => (p as any).gestione_id === filterGestione).map(p => p.id));
  const mobIds  = new Set((mobileProperties as any[]).filter(m => m.gestione_id === filterGestione).map(m => m.id));
  if (!(ex.property_real_id && realIds.has(ex.property_real_id)) &&
      !(ex.property_mobile_id && mobIds.has(ex.property_mobile_id))) return false;
}
```
Aggiungi `filterGestione, mobileProperties` alle dipendenze.

- [ ] **Step 3: Select filtro gestione nell'header** (prima del filtro proprietà)

```tsx
<Select value={filterGestione} onValueChange={setFilterGestione}>
  <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[150px] bg-white">
    <SelectValue placeholder="Gestione" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Tutte le gestioni</SelectItem>
    {gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
  </SelectContent>
</Select>
```

- [ ] **Step 4: Scelta conto nel dialog "Conferma Pagamento"**

Nel dialog conferma, sostituisci la griglia `METHOD_OPTIONS` con una select di conto. Aggiungi stato `const [confirmConto, setConfirmConto] = useState('');` e nel `confirmPayment.mutate` includi `conto_id: confirmConto`. Estendi la mutation `confirmPayment` per scrivere `conto_id`:

```tsx
<div className="grid gap-2">
  <Label>Conto</Label>
  <Select value={confirmConto} onValueChange={setConfirmConto}>
    <SelectTrigger><SelectValue placeholder="Da quale conto è uscita…" /></SelectTrigger>
    <SelectContent>
      {conti.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
    </SelectContent>
  </Select>
</div>
```
In `confirmPayment` (mutationFn) aggiungi `conto_id` all'`update`. Nel `saveExpense` payload, se `stato === 'pagato'`, includi `conto_id: form.conto_id` (aggiungi `conto_id: ''` a `DEFAULT_FORM` e una Select conto nello sheet, mostrata quando `stato === 'pagato'`).

- [ ] **Step 5: Verifica + Commit**

Run: `npm run build` → OK. Manuale: filtro gestione filtra le spese; confermando un pagamento scegli il conto.
```bash
git add src/pages/Expenses.tsx src/hooks/useProperties.ts
git commit -m "feat(spese): filtro gestione + scelta conto sul pagamento"
```

---

## Task 9: Filtro gestione + scelta conto in Incassi

**Files:**
- Modify: `src/components/Revenue.tsx`

- [ ] **Step 1: Import e dati** come Task 8 (`useGestioni`, `useConti`, `filterGestione`).

> Gli incassi (`tenant_payments`) si legano alla proprietà via `bookings.property_id`. Le `revenues` (in `useRevenue.ts`) devono esporre la gestione della proprietà: aggiorna la `select` per includere `bookings(property_id, properties_real(nome, gestione_id))`.

- [ ] **Step 2: Filtro gestione nel `filtered`**

```ts
if (filterGestione !== 'all') {
  const gid = r.bookings?.properties_real?.gestione_id;
  if (gid !== filterGestione) return false;
}
```
Aggiungi `filterGestione` alle dipendenze.

- [ ] **Step 3: Select filtro gestione** nell'header (come Task 8 Step 3).

- [ ] **Step 4: Scelta conto nel dialog "Conferma Incasso"**

Aggiungi `const [confirmConto, setConfirmConto] = useState('');`, una Select conto nel dialog (come Task 8 Step 4) e passa `conto_id: confirmConto` a `confirmPayment.mutateAsync`. Estendi `confirmPayment` in `useRevenue.ts` per scrivere `conto_id` su `tenant_payments`.

- [ ] **Step 5: Verifica + Commit**

Run: `npm run build` → OK. Manuale: filtro gestione + scelta conto in incasso.
```bash
git add src/components/Revenue.tsx src/hooks/useRevenue.ts
git commit -m "feat(incassi): filtro gestione + scelta conto sull'incasso"
```

---

## Task 10: Dialog Conto e Giroconto

**Files:**
- Create: `src/components/ContoDialog.tsx`, `src/components/GirocontoDialog.tsx`

- [ ] **Step 1: `ContoDialog.tsx`** (crea/modifica conto)

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useConti } from '@/hooks/useConti';

export function ContoDialog({ open, onOpenChange, gestioneId, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; gestioneId: string; editing?: any;
}) {
  const { createConto, updateConto } = useConti();
  const [form, setForm] = useState({ nome: '', tipo: 'banca', saldo_iniziale: '', data_apertura: format(new Date(), 'yyyy-MM-dd') });
  useEffect(() => {
    if (editing) setForm({ nome: editing.nome, tipo: editing.tipo, saldo_iniziale: String(editing.saldo_iniziale), data_apertura: editing.data_apertura });
    else setForm({ nome: '', tipo: 'banca', saldo_iniziale: '', data_apertura: format(new Date(), 'yyyy-MM-dd') });
  }, [editing, open]);

  const save = async () => {
    const payload = { gestione_id: gestioneId, nome: form.nome, tipo: form.tipo, saldo_iniziale: parseFloat(form.saldo_iniziale || '0'), data_apertura: form.data_apertura };
    if (editing) await updateConto.mutateAsync({ id: editing.id, ...payload });
    else await createConto.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Modifica conto' : 'Nuovo conto'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5"><Label>Nome</Label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Conto Intesa" /></div>
          <div className="grid gap-1.5"><Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="contanti">💵 Contanti</SelectItem><SelectItem value="banca">🏦 Banca</SelectItem></SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Saldo iniziale (€)</Label>
              <Input type="number" value={form.saldo_iniziale} onChange={e => setForm(f => ({ ...f, saldo_iniziale: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Data apertura</Label>
              <Input type="date" value={form.data_apertura} onChange={e => setForm(f => ({ ...f, data_apertura: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={!form.nome}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `GirocontoDialog.tsx`**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useGiroconti } from '@/hooks/useGiroconti';

export function GirocontoDialog({ open, onOpenChange, conti }: {
  open: boolean; onOpenChange: (o: boolean) => void; conti: any[];
}) {
  const { createGiroconto } = useGiroconti();
  const [form, setForm] = useState({ conto_from: '', conto_to: '', importo: '', data: format(new Date(), 'yyyy-MM-dd'), descrizione: '' });
  const save = async () => {
    await createGiroconto.mutateAsync({ conto_from: form.conto_from, conto_to: form.conto_to, importo: parseFloat(form.importo), data: form.data, descrizione: form.descrizione });
    onOpenChange(false);
    setForm({ conto_from: '', conto_to: '', importo: '', data: format(new Date(), 'yyyy-MM-dd'), descrizione: '' });
  };
  const valid = form.conto_from && form.conto_to && form.conto_from !== form.conto_to && parseFloat(form.importo) > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Giroconto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5"><Label>Da conto</Label>
            <Select value={form.conto_from} onValueChange={v => setForm(f => ({ ...f, conto_from: v }))}>
              <SelectTrigger><SelectValue placeholder="Conto di partenza" /></SelectTrigger>
              <SelectContent>{conti.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label>A conto</Label>
            <Select value={form.conto_to} onValueChange={v => setForm(f => ({ ...f, conto_to: v }))}>
              <SelectTrigger><SelectValue placeholder="Conto di destinazione" /></SelectTrigger>
              <SelectContent>{conti.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Importo (€)</Label>
              <Input type="number" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Nota</Label>
            <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={!valid}>Registra giroconto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verifica + Commit**

Run: `npm run build` → OK.
```bash
git add src/components/ContoDialog.tsx src/components/GirocontoDialog.tsx
git commit -m "feat: dialog conto e giroconto"
```

---

## Task 11: Estratto conto PDF

**Files:**
- Create: `src/components/EstrattoContoPDF.tsx`

- [ ] **Step 1: Studia il pattern esistente**

Leggi `src/components/TicketPDF.tsx` per vedere come viene usato `@react-pdf/renderer` (Document/Page/View/Text/StyleSheet) e come si fa il download (`pdf(...).toBlob()` o `PDFDownloadLink`). Replica lo stesso pattern.

- [ ] **Step 2: Tipi e builder righe**

Definisci una funzione pura che, dati incassi+spese+giroconti già filtrati e ordinati per data, produce righe `{ data, descrizione, proprieta, conto, entrata, uscita, saldo }` con saldo progressivo. Per "per gestione" raggruppa per conto (saldo progressivo per conto, partendo da `saldo_iniziale`); per "per proprietà" usa saldo progressivo = cumulato (entrate − uscite).

- [ ] **Step 3: Componente Document + funzione `downloadEstrattoConto(opts)`**

```tsx
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9 },
  title: { fontSize: 14, marginBottom: 4, fontWeight: 'bold' },
  sub: { fontSize: 9, color: '#555', marginBottom: 10 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ddd', paddingVertical: 3 },
  th: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, fontWeight: 'bold' },
  c_date: { width: '14%' }, c_desc: { width: '30%' }, c_prop: { width: '20%' },
  c_conto: { width: '14%' }, c_in: { width: '11%', textAlign: 'right' },
  c_out: { width: '11%', textAlign: 'right' }, c_saldo: { width: '0%' },
  totals: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 16, fontWeight: 'bold' },
});

export interface EstrattoRow { data: string; descrizione: string; proprieta: string; conto: string; entrata: number; uscita: number; saldo: number; }

export function EstrattoContoDoc({ titolo, periodo, rows, totEntrate, totUscite, saldoFinale }: {
  titolo: string; periodo: string; rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{titolo}</Text>
        <Text style={styles.sub}>{periodo}</Text>
        <View style={styles.th}>
          <Text style={styles.c_date}>Data</Text><Text style={styles.c_desc}>Descrizione</Text>
          <Text style={styles.c_prop}>Proprietà</Text><Text style={styles.c_conto}>Conto</Text>
          <Text style={styles.c_in}>Entrata</Text><Text style={styles.c_out}>Uscita</Text>
        </View>
        {rows.map((r, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.c_date}>{r.data}</Text><Text style={styles.c_desc}>{r.descrizione}</Text>
            <Text style={styles.c_prop}>{r.proprieta}</Text><Text style={styles.c_conto}>{r.conto}</Text>
            <Text style={styles.c_in}>{r.entrata ? r.entrata.toFixed(2) : ''}</Text>
            <Text style={styles.c_out}>{r.uscita ? r.uscita.toFixed(2) : ''}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text>Entrate: € {totEntrate.toFixed(2)}</Text>
          <Text>Uscite: € {totUscite.toFixed(2)}</Text>
          <Text>Saldo finale: € {saldoFinale.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadEstrattoConto(props: Parameters<typeof EstrattoContoDoc>[0], filename: string) {
  const blob = await pdf(<EstrattoContoDoc {...props} />).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```

> Se `TicketPDF.tsx` usa un'API diversa (es. `PDFDownloadLink`), adatta `downloadEstrattoConto` a quel pattern. L'import JSX in un `.tsx` è OK.

- [ ] **Step 4: Verifica + Commit**

Run: `npm run build` → OK.
```bash
git add src/components/EstrattoContoPDF.tsx
git commit -m "feat: estratto conto PDF (documento + download)"
```

---

## Task 12: Pagina Cassa + route + sidebar

**Files:**
- Create: `src/pages/Cassa.tsx`
- Modify: `src/App.tsx`, `src/components/Sidebar.tsx`

- [ ] **Step 1: `Cassa.tsx`**

Usa `useGestioni`, `useCassa`, `useConti`, e i dati per l'estratto conto. Struttura:
- Filtro gestione a tendina (Tutte / per gestione).
- KPI: liquidità totale + totale per gestione (somma `saldo` dei conti per `gestione_id`).
- Per ogni gestione: lista conti con `saldo`, pulsante "➕ Nuovo conto" (apre `ContoDialog` con `gestioneId`), "✏️" su ogni conto (apre `ContoDialog` con `editing`), "🔁 Giroconto" (apre `GirocontoDialog` con i conti di quella gestione), "⤓ Estratto conto" (apre un piccolo dialog di scelta periodo → chiama `downloadEstrattoConto`).
- Selettore periodo per l'estratto: mese / anno / intervallo / tutto.

Costruzione righe estratto per gestione: prendi incassi (`tenant_payments` pagati con `conto_id` in conti gestione), spese (`payments` pagate idem), giroconti tra conti della gestione, filtra per periodo, ordina per data, raggruppa per conto e calcola saldo progressivo da `saldo_iniziale`. Per proprietà: filtra i movimenti della proprietà selezionata.

```tsx
import React, { useState, useMemo } from 'react';
import { useGestioni } from '@/hooks/useGestioni';
import { useCassa } from '@/hooks/useCassa';
import { useConti } from '@/hooks/useConti';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { ContoDialog } from '@/components/ContoDialog';
import { GirocontoDialog } from '@/components/GirocontoDialog';
import { Plus, Pencil, ArrowLeftRight, Download, Wallet } from 'lucide-react';
import { downloadEstrattoConto } from '@/components/EstrattoContoPDF';
// + import supabase per caricare i movimenti dell'estratto on-demand

const fmt = (n: number) => '€' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Cassa() {
  const { data: gestioni = [] } = useGestioni();
  const { data: conti = [] } = useCassa();         // conti con .saldo
  const [filterGestione, setFilterGestione] = useState('all');
  const [contoDialog, setContoDialog] = useState<{ open: boolean; gestioneId: string; editing?: any }>({ open: false, gestioneId: '' });
  const [giroOpen, setGiroOpen] = useState<{ open: boolean; conti: any[] }>({ open: false, conti: [] });

  const gestioniView = filterGestione === 'all' ? gestioni : gestioni.filter((g: any) => g.id === filterGestione);
  const contiByGestione = (gid: string) => conti.filter((c: any) => c.gestione_id === gid);
  const totaleGestione = (gid: string) => contiByGestione(gid).reduce((s: number, c: any) => s + c.saldo, 0);
  const totale = conti.reduce((s: number, c: any) => s + c.saldo, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <PageHeader title="Cassa">
        <Select value={filterGestione} onValueChange={setFilterGestione}>
          <SelectTrigger className="h-9 w-[180px] bg-white"><SelectValue placeholder="Gestione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le gestioni</SelectItem>
            {gestioni.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <Card className="border-green-200 bg-green-50"><CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 rounded-full bg-green-100"><Wallet className="w-6 h-6 text-green-600" /></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Liquidità totale</p>
          <p className="text-2xl font-bold">{fmt(totale)}</p></div>
      </CardContent></Card>

      {gestioniView.map((g: any) => (
        <Card key={g.id}><CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
            <span className="font-bold">{g.nome} · {fmt(totaleGestione(g.id))}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setContoDialog({ open: true, gestioneId: g.id })}><Plus className="w-3.5 h-3.5 mr-1" />Conto</Button>
              <Button size="sm" variant="outline" onClick={() => setGiroOpen({ open: true, conti: contiByGestione(g.id) })}><ArrowLeftRight className="w-3.5 h-3.5 mr-1" />Giroconto</Button>
              {/* Estratto conto: apri dialog periodo poi downloadEstrattoConto(...) */}
            </div>
          </div>
          <div className="divide-y">
            {contiByGestione(g.id).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span>{c.tipo === 'contanti' ? '💵' : '🏦'} {c.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{fmt(c.saldo)}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setContoDialog({ open: true, gestioneId: g.id, editing: c })}><Pencil className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
            {contiByGestione(g.id).length === 0 && <p className="px-4 py-4 text-sm text-slate-400">Nessun conto. Aggiungine uno.</p>}
          </div>
        </CardContent></Card>
      ))}

      <ContoDialog open={contoDialog.open} onOpenChange={o => setContoDialog(s => ({ ...s, open: o }))} gestioneId={contoDialog.gestioneId} editing={contoDialog.editing} />
      <GirocontoDialog open={giroOpen.open} onOpenChange={o => setGiroOpen(s => ({ ...s, open: o }))} conti={giroOpen.conti} />
    </div>
  );
}
```

- [ ] **Step 2: Route in `App.tsx`**

Importa `import Cassa from "@/pages/Cassa";` e aggiungi dentro le route protette: `<Route path="cassa" element={<Cassa />} />`.

- [ ] **Step 3: Voce sidebar**

In `src/components/Sidebar.tsx`, nella sezione `Finanziario`, aggiungi come primo item:
`{ id: 'cassa', label: 'Cassa', icon: Wallet, path: '/cassa' },`
(usa un'icona già importata, es. `Wallet`; cambia l'icona di Incassi se serve evitare duplicati, es. `Banknote`/`Coins`).

- [ ] **Step 4: Estratto conto dalla pagina (collega il download)**

Aggiungi un dialog "Estratto conto" con selezione periodo (mese/anno/intervallo/tutto) e livello (gestione corrente o una proprietà). Al conferma, carica i movimenti via supabase, costruisci le righe (Task 11 Step 2) e chiama `downloadEstrattoConto`. Verifica saldo progressivo e totali su dati reali.

- [ ] **Step 5: Verifica + Commit**

Run: `npm run build` → OK. Manuale: la pagina Cassa mostra i saldi; crei conto, fai giroconto, scarichi PDF.
```bash
git add src/pages/Cassa.tsx src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: pagina Cassa con conti, giroconti ed estratto conto"
```

---

## Task 13: Verifica finale & deploy

- [ ] **Step 1: Test logica pura**

Run: `npm run test`
Expected: tutti i test (scadenze + cassa) PASS.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: nessun errore.

- [ ] **Step 3: Smoke test manuale sul deploy**

- Spesa/incasso con scadenza oggi → compare in "Questa settimana / Oggi".
- Ricerca filtra in tutte le tab.
- Assegna gestione a 1-2 proprietà; crea conti con saldo iniziale; filtro gestione funziona.
- Conferma un pagamento su un conto → saldo cassa cambia.
- Giroconto sposta tra conti.
- Estratto conto PDF per gestione e per proprietà scaricabile e coerente.

- [ ] **Step 4: Push su GitHub** (l'utente rivede sul deploy live)

```bash
git push origin main
```

---

## Self-Review (autore)

**Spec coverage:**
- Ricerca → Task 3/4 ✓ · Fix oggi + per-giorno → Task 2/3/4 ✓ · Gestioni → Task 1/7 ✓ · Conti+saldi (Piano A) → Task 1/6 ✓ · Conto su movimenti → Task 8/9 ✓ · Giroconti → Task 1/5/10 ✓ · Pagina Cassa → Task 12 ✓ · Estratto conto PDF (gestione+proprietà) → Task 11/12 ✓ · Filtro gestione per pagina → Task 8/9/12 ✓ · Migrazione/setup → Task 1 + smoke ✓.
- `income` fuori scope, incassi su `tenant_payments` ✓.

**Note di esecuzione:**
- `usePropertiesReal`/query mobile/`useRevenue` vanno estese a includere `gestione_id` (indicato in Task 8/9). Verificare le `select` reali prima di filtrare.
- Adattare `downloadEstrattoConto` all'API effettiva usata da `TicketPDF.tsx`.
- Nessun test framework preesistente: i test coprono solo la logica pura (scadenze, cassa); il resto è verificato con build/lint + smoke manuale.
