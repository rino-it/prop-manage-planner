# Estratto per Proprietà & Assegnazione Movimenti senza Conto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere l'estratto conto PDF per singola proprietà (oltre che per gestione) e uno strumento nella pagina Cassa per assegnare in blocco i movimenti realizzati rimasti senza conto.

**Architecture:** Logica pura isolata in `src/utils` con test vitest (costruzione righe estratto proprietà; normalizzazione movimenti senza conto). UI estende `Cassa.tsx` (toggle nel dialog estratto, banner) e aggiunge `AssegnaContiDialog`. Nessuna modifica al DB.

**Tech Stack:** React 18, Vite, TS, shadcn/ui, TanStack Query, Supabase, date-fns, @react-pdf/renderer, vitest.

**Riferimento spec:** `docs/superpowers/specs/2026-06-12-estratto-proprieta-assegna-conti-design.md`

**Nota Hallmark (component-scope):** banner + dialog sono component-scope. In implementazione: adottare i token/componenti shadcn esistenti (niente nuovo linguaggio visivo), coprire gli stati interattivi (default/hover/focus/active/disabled/loading), copy onesto (il conteggio N è reale), responsive 320–768px. No macrostruttura/hero/nav.

---

## File Structure

**Nuovi file**
- `src/utils/estrattoProprieta.ts` — costruzione righe + saldo progressivo da 0 + totali (puro).
- `src/utils/estrattoProprieta.test.ts` — test vitest.
- `src/utils/movimentiSenzaConto.ts` — normalizzazione movimenti senza conto (puro).
- `src/utils/movimentiSenzaConto.test.ts` — test vitest.
- `src/hooks/useMovimentiSenzaConto.ts` — fetch movimenti realizzati senza conto + mutation di assegnazione.
- `src/components/AssegnaContiDialog.tsx` — dialog assegnazione in blocco.

**File modificati**
- `src/pages/Cassa.tsx` — toggle Gestione/Proprietà + builder estratto proprietà nell'`EstrattoDialog`; lista proprietà; banner + apertura `AssegnaContiDialog`.

---

## Task 1: Util puro `buildRowsProprieta` (+ test)

Dati i movimenti realizzati di una proprietà (già filtrati per periodo), produce le righe dell'estratto con saldo progressivo da 0 e i totali.

**Files:**
- Create: `src/utils/estrattoProprieta.ts`
- Test: `src/utils/estrattoProprieta.test.ts`

- [ ] **Step 1: Scrivi il test (fallisce)**

`src/utils/estrattoProprieta.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildRowsProprieta, type MovProprieta } from './estrattoProprieta';

const contoNome = (id: string | null) => (id ? ({ c1: 'Conto Intesa' } as Record<string, string>)[id] || '—' : '—');

describe('buildRowsProprieta', () => {
  it('ordina per data e calcola il saldo progressivo da 0', () => {
    const movs: MovProprieta[] = [
      { data: '2026-06-10', descrizione: 'Affitto', conto_id: 'c1', entrata: 500, uscita: 0 },
      { data: '2026-06-05', descrizione: 'Idraulico', conto_id: 'c1', entrata: 0, uscita: 200 },
    ];
    const r = buildRowsProprieta(movs, 'Via Roma', contoNome);
    expect(r.rows.map(x => x.descrizione)).toEqual(['Idraulico', 'Affitto']);
    expect(r.rows[0].saldo).toBe(-200);
    expect(r.rows[1].saldo).toBe(300);
    expect(r.totEntrate).toBe(500);
    expect(r.totUscite).toBe(200);
    expect(r.saldoFinale).toBe(300);
  });

  it('formatta la data in dd/MM/yyyy, riempie proprietà e conto', () => {
    const r = buildRowsProprieta(
      [{ data: '2026-06-05', descrizione: 'X', conto_id: 'c1', entrata: 10, uscita: 0 }],
      'Via Roma', contoNome,
    );
    expect(r.rows[0].data).toBe('05/06/2026');
    expect(r.rows[0].proprieta).toBe('Via Roma');
    expect(r.rows[0].conto).toBe('Conto Intesa');
  });

  it('mostra "—" quando il conto manca', () => {
    const r = buildRowsProprieta(
      [{ data: '2026-06-05', descrizione: 'X', conto_id: null, entrata: 0, uscita: 50 }],
      'Via Roma', contoNome,
    );
    expect(r.rows[0].conto).toBe('—');
  });
});
```

- [ ] **Step 2: Esegui, deve fallire**

Run: `npx vitest run src/utils/estrattoProprieta.test.ts`
Expected: FAIL ("buildRowsProprieta is not a function").

- [ ] **Step 3: Implementa `src/utils/estrattoProprieta.ts`**

```ts
import { format, parseISO } from 'date-fns';
import type { EstrattoRow } from '@/components/EstrattoContoPDF';

export interface MovProprieta {
  data: string;            // ISO, almeno yyyy-MM-dd
  descrizione: string;
  conto_id: string | null;
  entrata: number;
  uscita: number;
}

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
}

export function buildRowsProprieta(
  movs: MovProprieta[],
  propNome: string,
  contoNome: (id: string | null) => string,
): { rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number } {
  const sorted = [...movs].sort((a, b) => a.data.slice(0, 10).localeCompare(b.data.slice(0, 10)));
  let running = 0;
  let totEntrate = 0;
  let totUscite = 0;
  const rows: EstrattoRow[] = sorted.map(m => {
    running += Number(m.entrata) - Number(m.uscita);
    totEntrate += Number(m.entrata);
    totUscite += Number(m.uscita);
    return {
      data: fmtDate(m.data),
      descrizione: m.descrizione,
      proprieta: propNome,
      conto: contoNome(m.conto_id),
      entrata: Number(m.entrata),
      uscita: Number(m.uscita),
      saldo: running,
    };
  });
  return { rows, totEntrate, totUscite, saldoFinale: totEntrate - totUscite };
}
```

- [ ] **Step 4: Esegui, deve passare**

Run: `npx vitest run src/utils/estrattoProprieta.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/estrattoProprieta.ts src/utils/estrattoProprieta.test.ts
git commit -m "feat: util puro estratto conto per proprietà (saldo progressivo da 0)"
```

---

## Task 2: Estratto per proprietà nell'`EstrattoDialog` (Cassa.tsx)

Aggiunge il toggle Gestione/Proprietà, il fetch dei movimenti della proprietà e il collegamento al PDF.

**Files:**
- Modify: `src/pages/Cassa.tsx`

- [ ] **Step 1: Estendi il tipo target e importa quanto serve**

In cima a `Cassa.tsx`:
- Aggiungi import: `import { usePropertiesReal } from '@/hooks/useProperties';`
- Aggiungi import: `import { useQuery } from '@tanstack/react-query';`
- Aggiungi import: `import { buildRowsProprieta, type MovProprieta } from '@/utils/estrattoProprieta';`
- Cambia l'interfaccia `EstrattoTarget` in:
```ts
interface EstrattoTarget { level: 'gestione' | 'proprieta'; id: string; nome: string; isMobile?: boolean }
```

- [ ] **Step 2: Aggiungi il builder per proprietà (vicino a `buildEstrattoGestione`)**

```ts
async function buildEstrattoProprieta(
  target: { id: string; nome: string; isMobile?: boolean },
  contoNome: (id: string | null) => string,
  preset: string,
  from: string,
  to: string,
): Promise<{ rows: EstrattoRow[]; totEntrate: number; totUscite: number; saldoFinale: number }> {
  const SENTINEL = '1900-01-01';
  const movs: MovProprieta[] = [];

  // Spese pagate della proprietà
  const speseQuery = supabase
    .from('payments')
    .select('importo, data_pagamento, descrizione, conto_id, stato')
    .eq('stato', 'pagato')
    .eq(target.isMobile ? 'property_mobile_id' : 'property_real_id', target.id);
  const { data: spese } = await speseQuery;
  for (const sp of spese || []) {
    const dateStr: string = sp.data_pagamento || '';
    if (!inPeriod(dateStr, preset, from, to, SENTINEL)) continue;
    movs.push({
      data: dateStr,
      descrizione: sp.descrizione || 'Spesa',
      conto_id: sp.conto_id ?? null,
      entrata: 0,
      uscita: Number(sp.importo),
    });
  }

  // Incassi incassati della proprietà (solo immobili: passano per i bookings)
  if (!target.isMobile) {
    const { data: incassi } = await supabase
      .from('tenant_payments')
      .select('importo, payment_date, description, notes, conto_id, stato, bookings!inner(property_id)')
      .eq('stato', 'pagato')
      .eq('bookings.property_id', target.id);
    for (const inc of incassi || []) {
      const dateStr: string = inc.payment_date || '';
      if (!inPeriod(dateStr, preset, from, to, SENTINEL)) continue;
      movs.push({
        data: dateStr,
        descrizione: inc.description || inc.notes || 'Incasso',
        conto_id: inc.conto_id ?? null,
        entrata: Number(inc.importo),
        uscita: 0,
      });
    }
  }

  return buildRowsProprieta(movs, target.nome, contoNome);
}
```

- [ ] **Step 3: Estendi `EstrattoDialog` con il toggle e il selettore**

Cambia la firma e il corpo di `EstrattoDialog`. Nuove props: `gestioni`, `properties`, `contiByGestione`, `conti` (per la mappa nome). Sostituisci l'attuale definizione del componente con:

```tsx
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
  const [level, setLevel] = useState<'gestione' | 'proprieta'>('gestione');
  const [gestioneId, setGestioneId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [preset, setPreset] = useState<'tutto' | 'anno' | 'mese' | 'custom'>('tutto');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(new Date(), 'yyyy-01-01'));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  // init dallo stato di apertura
  React.useEffect(() => {
    if (!target) return;
    setLevel(target.level);
    if (target.level === 'gestione') setGestioneId(target.id);
    else setPropertyId(target.id);
  }, [target]);

  const contoNome = (id: string | null) =>
    id ? (conti.find((c: any) => c.id === id)?.nome || '—') : '—';

  const handleDownload = async () => {
    setLoading(true);
    try {
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

  const canDownload = level === 'gestione' ? !!gestioneId : !!propertyId;

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Estratto conto</DialogTitle>
          <DialogDescription>Scegli cosa esportare e il periodo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          {/* Toggle livello */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg gap-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${level === 'gestione' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              onClick={() => setLevel('gestione')}
            >Per gestione</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${level === 'proprieta' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              onClick={() => setLevel('proprieta')}
            >Per proprietà</button>
          </div>

          {level === 'gestione' ? (
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
```
(`buildEstrattoGestione`, `periodLabel`, `downloadEstrattoConto`, `EstrattoRow` restano com'erano.)

- [ ] **Step 4: Costruisci la lista proprietà nel componente `Cassa` e passala al dialog**

Dentro `export default function Cassa()`:
- Aggiungi: `const { data: realProps = [] } = usePropertiesReal();`
- Aggiungi la query veicoli:
```tsx
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
```
- Sostituisci il render di `<EstrattoDialog ... />` (in fondo) con:
```tsx
<EstrattoDialog
  target={estratto}
  onClose={() => setEstratto(null)}
  gestioni={gestioni}
  properties={properties}
  contiByGestione={contiByGestione}
  conti={conti}
/>
```
(Le vecchie props `totaleGestione` non servono più al dialog: rimuovile dalla chiamata.)

- [ ] **Step 5: Verifica**

Run: `npm run build` → OK.
Run: `npx vitest run` → tutti verdi.
Manuale: apri "Estratto conto", commuta su "Per proprietà", scegli una proprietà e un periodo, scarica → il PDF mostra i movimenti realizzati di quella proprietà con saldo progressivo coerente.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Cassa.tsx
git commit -m "feat(cassa): estratto conto per proprietà (toggle gestione/proprietà)"
```

---

## Task 3: Util puro `normalizeUnassigned` (+ test)

Normalizza spese+incassi senza conto in una lista unica con `gestione_id` risolto.

**Files:**
- Create: `src/utils/movimentiSenzaConto.ts`
- Test: `src/utils/movimentiSenzaConto.test.ts`

- [ ] **Step 1: Test (fallisce)**

`src/utils/movimentiSenzaConto.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeUnassigned, type MovSenzaConto } from './movimentiSenzaConto';

describe('normalizeUnassigned', () => {
  const spese = [
    { id: 's1', importo: 100, data_pagamento: '2026-06-05', descrizione: 'Idraulico',
      property_real_id: 'p1', property_mobile_id: null,
      properties_real: { nome: 'Via Roma', gestione_id: 'g1' }, properties_mobile: null },
    { id: 's2', importo: 50, data_pagamento: '2026-06-06', descrizione: 'Bollo',
      property_real_id: null, property_mobile_id: 'm1',
      properties_real: null, properties_mobile: { veicolo: 'Panda', gestione_id: 'g2' } },
    { id: 's3', importo: 30, data_pagamento: '2026-06-07', descrizione: 'Generale',
      property_real_id: null, property_mobile_id: null, properties_real: null, properties_mobile: null },
  ];
  const incassi = [
    { id: 'i1', importo: 500, payment_date: '2026-06-08', description: 'Affitto', notes: null,
      bookings: { properties_real: { nome: 'Via Roma', gestione_id: 'g1' } } },
  ];

  it('unisce spese e incassi con tipo, gestione_id e proprietà', () => {
    const r: MovSenzaConto[] = normalizeUnassigned(spese, incassi);
    expect(r).toHaveLength(4);
    const s1 = r.find(x => x.id === 's1' && x.tipo === 'spesa')!;
    expect(s1.gestione_id).toBe('g1');
    expect(s1.proprieta).toBe('Via Roma');
    expect(s1.importo).toBe(100);
    const s2 = r.find(x => x.id === 's2')!;
    expect(s2.gestione_id).toBe('g2');
    expect(s2.proprieta).toBe('Panda');
    const i1 = r.find(x => x.tipo === 'incasso')!;
    expect(i1.gestione_id).toBe('g1');
    expect(i1.descrizione).toBe('Affitto');
  });

  it('movimenti senza proprietà hanno gestione_id null', () => {
    const r = normalizeUnassigned(spese, incassi);
    const s3 = r.find(x => x.id === 's3')!;
    expect(s3.gestione_id).toBeNull();
    expect(s3.proprieta).toBe('');
  });
});
```

- [ ] **Step 2: Esegui, fallisce**

Run: `npx vitest run src/utils/movimentiSenzaConto.test.ts` → FAIL.

- [ ] **Step 3: Implementa `src/utils/movimentiSenzaConto.ts`**

```ts
export interface MovSenzaConto {
  id: string;
  tipo: 'spesa' | 'incasso';
  data: string;
  descrizione: string;
  proprieta: string;
  gestione_id: string | null;
  importo: number;
}

export function normalizeUnassigned(spese: any[], incassi: any[]): MovSenzaConto[] {
  const out: MovSenzaConto[] = [];

  for (const sp of spese || []) {
    const real = sp.properties_real;
    const mob = sp.properties_mobile;
    out.push({
      id: sp.id,
      tipo: 'spesa',
      data: sp.data_pagamento || '',
      descrizione: sp.descrizione || 'Spesa',
      proprieta: real?.nome || mob?.veicolo || '',
      gestione_id: real?.gestione_id ?? mob?.gestione_id ?? null,
      importo: Number(sp.importo),
    });
  }

  for (const inc of incassi || []) {
    const real = inc.bookings?.properties_real;
    out.push({
      id: inc.id,
      tipo: 'incasso',
      data: inc.payment_date || '',
      descrizione: inc.description || inc.notes || 'Incasso',
      proprieta: real?.nome || '',
      gestione_id: real?.gestione_id ?? null,
      importo: Number(inc.importo),
    });
  }

  return out;
}
```

- [ ] **Step 4: Esegui, passa**

Run: `npx vitest run src/utils/movimentiSenzaConto.test.ts` → PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/movimentiSenzaConto.ts src/utils/movimentiSenzaConto.test.ts
git commit -m "feat: util puro normalizzazione movimenti senza conto"
```

---

## Task 4: Hook `useMovimentiSenzaConto` (fetch + assegna)

**Files:**
- Create: `src/hooks/useMovimentiSenzaConto.ts`

- [ ] **Step 1: Implementa l'hook**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUnassigned, type MovSenzaConto } from '@/utils/movimentiSenzaConto';

export function useMovimentiSenzaConto() {
  const qc = useQueryClient();

  const list = useQuery<MovSenzaConto[]>({
    queryKey: ['movimenti-senza-conto'],
    queryFn: async () => {
      const [{ data: spese }, { data: incassi }] = await Promise.all([
        supabase
          .from('payments')
          .select('id, importo, data_pagamento, descrizione, property_real_id, property_mobile_id, properties_real(nome, gestione_id), properties_mobile(veicolo, gestione_id)')
          .is('conto_id', null)
          .eq('stato', 'pagato'),
        supabase
          .from('tenant_payments')
          .select('id, importo, payment_date, description, notes, bookings(properties_real(nome, gestione_id))')
          .is('conto_id', null)
          .eq('stato', 'pagato'),
      ]);
      return normalizeUnassigned(spese || [], incassi || []);
    },
  });

  // assignments: { id, tipo, conto_id }
  const assegna = useMutation({
    mutationFn: async (assignments: Array<{ id: string; tipo: 'spesa' | 'incasso'; conto_id: string }>) => {
      const spese = assignments.filter(a => a.tipo === 'spesa');
      const incassi = assignments.filter(a => a.tipo === 'incasso');
      for (const a of spese) {
        const { error } = await supabase.from('payments').update({ conto_id: a.conto_id }).eq('id', a.id);
        if (error) throw error;
      }
      for (const a of incassi) {
        const { error } = await supabase.from('tenant_payments').update({ conto_id: a.conto_id }).eq('id', a.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimenti-senza-conto'] });
      qc.invalidateQueries({ queryKey: ['cassa'] });
      qc.invalidateQueries({ queryKey: ['conti'] });
      qc.invalidateQueries({ queryKey: ['unified-expenses'] });
    },
  });

  return { ...list, assegna };
}
```

- [ ] **Step 2: Verifica + Commit**

Run: `npm run build` → OK.
```bash
git add src/hooks/useMovimentiSenzaConto.ts
git commit -m "feat: hook movimenti senza conto (fetch + assegnazione)"
```

---

## Task 5: `AssegnaContiDialog`

Dialog: scegli gestione + conto di default; lista dei movimenti della gestione + senza gestione; checkbox per riga + tendina conto per riga; azione massa; salva.

**Files:**
- Create: `src/components/AssegnaContiDialog.tsx`

- [ ] **Step 1: Implementa il componente**

```tsx
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
  const [perRow, setPerRow] = useState<Record<string, string>>({}); // key `${tipo}:${id}` -> conto_id
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const contiGestione = useMemo(
    () => (conti as any[]).filter(c => c.gestione_id === gestioneId),
    [conti, gestioneId],
  );

  // Movimenti della gestione scelta + quelli senza gestione
  const visibili = useMemo(
    () => (movimenti as any[]).filter(m => m.gestione_id === gestioneId || m.gestione_id == null),
    [movimenti, gestioneId],
  );

  const key = (m: any) => `${m.tipo}:${m.id}`;

  // reset quando cambio gestione
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
      <DialogContent className="sm:max-w-2xl max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assegna movimenti a un conto</DialogTitle>
          <DialogDescription>Scegli la gestione e il conto, poi assegna i movimenti realizzati rimasti senza conto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{visibili.length} movimenti senza conto</span>
                <Button size="sm" variant="outline" disabled={!contoDefault} onClick={assegnaSelezionati}>
                  Assegna i selezionati al conto di default
                </Button>
              </div>

              <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
                {visibili.length === 0 && <p className="px-4 py-4 text-sm text-slate-400">Nessun movimento da assegnare per questa gestione.</p>}
                {visibili.map(m => (
                  <div key={key(m)} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox checked={!!checked[key(m)]} onCheckedChange={v => setChecked(s => ({ ...s, [key(m)]: !!v }))} />
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.tipo === 'incasso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {m.tipo === 'incasso' ? 'Incasso' : 'Spesa'}
                    </span>
                    <span className="text-slate-400 tabular-nums">{fmtDate(m.data)}</span>
                    <span className="flex-1 truncate">{m.descrizione}{m.proprieta ? ` · ${m.proprieta}` : ''}</span>
                    <span className="font-semibold tabular-nums">{fmt(m.importo)}</span>
                    <Select value={perRow[key(m)] || ''} onValueChange={v => setPerRow(s => ({ ...s, [key(m)]: v }))}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Conto…" /></SelectTrigger>
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
```

> Verifica che esista `src/components/ui/checkbox.tsx` (shadcn). Se manca, generalo con `npx shadcn@latest add checkbox` oppure usa un `<input type="checkbox">` stilizzato. La lista dei componenti Ui esistenti è in `src/components/ui/` (Radix checkbox è già una dipendenza in package.json: `@radix-ui/react-checkbox`).

- [ ] **Step 2: Verifica + Commit**

Run: `npm run build` → OK.
```bash
git add src/components/AssegnaContiDialog.tsx
git commit -m "feat: dialog assegnazione movimenti senza conto"
```

---

## Task 6: Banner + apertura dialog in Cassa

**Files:**
- Modify: `src/pages/Cassa.tsx`

- [ ] **Step 1: Import e stato**

In `Cassa.tsx`:
- `import { AssegnaContiDialog } from '@/components/AssegnaContiDialog';`
- `import { useMovimentiSenzaConto } from '@/hooks/useMovimentiSenzaConto';`
- `import { AlertTriangle } from 'lucide-react';`
- Nel componente `Cassa`: `const { data: senzaConto = [] } = useMovimentiSenzaConto();` e `const [assegnaOpen, setAssegnaOpen] = useState(false);`

- [ ] **Step 2: Banner sotto la card "Liquidità totale"**

Subito dopo la `Card` della liquidità totale, aggiungi:
```tsx
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
```

- [ ] **Step 3: Render del dialog**

Vicino agli altri dialog in fondo:
```tsx
<AssegnaContiDialog open={assegnaOpen} onOpenChange={setAssegnaOpen} />
```

- [ ] **Step 4: Verifica**

Run: `npm run build` → OK. `npx vitest run` → verde.
Manuale: se ci sono spese pagate/incassi senza conto, appare il banner; "Assegna" apre il dialog; scegli gestione+conto, spunti righe, "Assegna i selezionati", salva → la cassa si aggiorna e il banner sparisce/diminuisce.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Cassa.tsx
git commit -m "feat(cassa): banner + dialog per assegnare i movimenti senza conto"
```

---

## Task 7: Rifinitura Hallmark (component-scope) + verifica finale + merge/push

**Files:**
- Modify: `src/components/AssegnaContiDialog.tsx`, `src/pages/Cassa.tsx` (solo rifiniture)

- [ ] **Step 1: Pass Hallmark component-scope sui nuovi elementi**

Rivedi banner + `EstrattoDialog` toggle + `AssegnaContiDialog` contro la disciplina component-scope di Hallmark (già in contesto):
- Stati interattivi completi: `:focus-visible` visibile su bottoni/checkbox/Select; stato disabled coerente; stato loading sul bottone "Salva/Scarica" (già presente — verifica testo + spinner/label).
- Token: usa le classi/utility shadcn esistenti, niente colori hard-coded fuori palette (gli `amber/green/red` usati sono coerenti con lo stile attuale della pagina — ok).
- Copy onesto: il conteggio del banner è reale; nessun numero inventato.
- Responsive: verifica il dialog assegnazione a 320/375px (la riga lista deve restare leggibile — eventualmente manda la tendina conto a capo su mobile con `flex-wrap`).
- Nessuna chrome finta, nessun heading in corsivo.
Applica le correzioni minime necessarie (es. `flex-wrap` sulle righe della lista, `focus-visible:ring` dove manca).

- [ ] **Step 2: Verifica completa**

Run: `npx vitest run` → tutti i test (scadenze 5 + cassa 4 + estrattoProprieta 3 + movimentiSenzaConto 2 = 14) verdi.
Run: `npm run build` → OK.

- [ ] **Step 3: Commit rifiniture**

```bash
git add -A
git commit -m "polish(cassa): rifinitura Hallmark component-scope (stati, focus, responsive)"
```

- [ ] **Step 4: Merge su main e push**

```bash
git checkout main
git merge --no-ff feat/estratto-proprieta-assegna-conti -m "feat: estratto conto per proprietà + assegnazione movimenti senza conto"
git push origin main
```

---

## Self-Review (autore)

**Spec coverage:**
- Estratto per proprietà, da Cassa, toggle gestione/proprietà → Task 2 ✓
- Solo movimenti realizzati, saldo progressivo da 0, conto "—" se assente → Task 1 (pure) + Task 2 ✓
- Banner + dialog assegnazione in Cassa → Task 6 + Task 5 ✓
- Solo movimenti realizzati senza conto → Task 4 (query `stato='pagato'` + `conto_id is null`) ✓
- Selezione multipla + tendina per riga (modello C) → Task 5 ✓
- Mostra anche movimenti senza gestione → Task 5 (`m.gestione_id == null`) ✓
- Matching gestione (spese via property; incassi via booking) → Task 3 ✓
- Hallmark component-scope → Task 7 ✓

**Note di esecuzione:**
- Task 2 rimuove la prop `totaleGestione` dalla chiamata a `EstrattoDialog`: assicurarsi che non resti referenziata.
- `bookings!inner(property_id)` richiede che la relazione `tenant_payments → bookings` sia presente (lo è: usata altrove). Se la sintassi inner desse problemi di tipi, filtrare lato client su `inc.bookings?.property_id` dopo un select normale.
- Checkbox: dipende da `@radix-ui/react-checkbox` (già in package.json) e dal wrapper shadcn `ui/checkbox`; se assente, generarlo.
- Nessun nuovo `any` in più del consueto stile del repo; il lint resta sul baseline esistente.
