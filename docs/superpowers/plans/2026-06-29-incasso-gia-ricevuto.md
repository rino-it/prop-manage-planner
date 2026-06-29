# Incasso "già ricevuto" inline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di registrare un incasso occasionale **già ricevuto** come `pagato` in un solo passaggio (data/metodo/conto inline), invece del flusso create→Incassa in due passaggi.

**Architecture:** Estraiamo la logica di costruzione delle righe `tenant_payments` da `createPaymentPlan` in un helper puro testabile (`src/utils/incassi.ts`), aggiungendo il ramo "già pagato". Poi colleghiamo il form di `Revenue.tsx` con un segmented control "Stato" (Da incassare / Già incassato) che rivela i campi di pagamento e nasconde il piano rateale.

**Tech Stack:** React + TypeScript, Vite, @tanstack/react-query, Supabase, date-fns, Vitest (solo unit test su funzioni pure in `src/utils/`, come il resto del codebase).

## Global Constraints

- Nessuna migrazione DB: `payment_date`, `payment_type`, `conto_id`, `stato` esistono già su `tenant_payments`.
- Il ramo ricorrente (`is_recurring`) resta invariato: sempre `stato: 'da_pagare'`.
- "Già incassato" è mutuamente esclusivo con "Piano rateale" (forza `is_recurring=false`).
- Conto **opzionale** anche in modalità "già incassato" (come l'attuale dialog Conferma Incasso).
- Metodi pagamento: riusare i valori esistenti `bonifico | contanti | stripe | paypal | altro` (default `bonifico`).
- Seguire il pattern del codebase: unit test Vitest solo sull'helper puro; i componenti non hanno test (nessun testing-library installato).

---

### Task 1: Helper puro `buildPaymentRows` + ramo "già pagato"

Estrae la logica di costruzione righe da `createPaymentPlan` in una funzione pura e aggiunge il ramo `already_paid`. La purezza si ottiene passando `userId` e `groupId` come argomenti (niente `crypto`/`auth` dentro l'helper).

**Files:**
- Create: `src/utils/incassi.ts`
- Test: `src/utils/incassi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface BuildPaymentRowsParams {
    booking_id: string;
    amount: number;
    date_start: Date;
    months: number;
    category: string;
    description: string;
    is_recurring: boolean;
    already_paid?: boolean;
    payment_method?: string;   // default 'bonifico'
    conto_id?: string;         // '' => null
  }
  export function buildPaymentRows(
    params: BuildPaymentRowsParams,
    userId: string,
    groupId: string | null,
  ): Record<string, unknown>[]
  ```
  Regole:
  - Ricorrente: `months` righe, `stato: 'da_pagare'`, `recurrence_group_id: groupId`, note `"<desc> (Rata i/months)"`. Mai `already_paid` (ignorato se `is_recurring`).
  - Singolo non pagato: 1 riga `stato: 'da_pagare'`, `recurrence_group_id: null`, note `<desc>`.
  - Singolo `already_paid`: 1 riga con
    `stato: 'pagato'`, `data_scadenza: format(date_start,'yyyy-MM-dd')`,
    `payment_date: date_start.toISOString()`,
    `payment_type: payment_method ?? 'bonifico'`,
    `conto_id: conto_id || null`.
  - Ogni riga include sempre: `booking_id, importo: amount, data_scadenza, category, notes, is_recurring, user_id: userId`.

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
// src/utils/incassi.test.ts
import { describe, it, expect } from 'vitest';
import { buildPaymentRows } from './incassi';

const base = {
  booking_id: 'b1', amount: 500, date_start: new Date('2026-09-01T00:00:00'),
  months: 3, category: 'canone_locazione', description: 'Acconto', is_recurring: false,
};

describe('buildPaymentRows', () => {
  it('singolo da incassare: 1 riga da_pagare senza campi pagamento', () => {
    const rows = buildPaymentRows(base, 'u1', null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      booking_id: 'b1', importo: 500, data_scadenza: '2026-09-01',
      category: 'canone_locazione', notes: 'Acconto', stato: 'da_pagare',
      is_recurring: false, recurrence_group_id: null, user_id: 'u1',
    });
    expect(rows[0].payment_date).toBeUndefined();
    expect(rows[0].payment_type).toBeUndefined();
  });

  it('singolo già incassato: 1 riga pagato con data/metodo/conto', () => {
    const rows = buildPaymentRows(
      { ...base, already_paid: true, payment_method: 'contanti', conto_id: 'c9' },
      'u1', null,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stato: 'pagato', data_scadenza: '2026-09-01',
      payment_date: new Date('2026-09-01T00:00:00').toISOString(),
      payment_type: 'contanti', conto_id: 'c9',
    });
  });

  it('già incassato senza conto: conto_id null e metodo default bonifico', () => {
    const rows = buildPaymentRows({ ...base, already_paid: true, conto_id: '' }, 'u1', null);
    expect(rows[0]).toMatchObject({ stato: 'pagato', conto_id: null, payment_type: 'bonifico' });
  });

  it('ricorrente: genera months righe da_pagare ignorando already_paid', () => {
    const rows = buildPaymentRows(
      { ...base, is_recurring: true, already_paid: true }, 'u1', 'g1',
    );
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.stato)).toEqual(['da_pagare', 'da_pagare', 'da_pagare']);
    expect(rows[0]).toMatchObject({ data_scadenza: '2026-09-01', notes: 'Acconto (Rata 1/3)', recurrence_group_id: 'g1' });
    expect(rows[2]).toMatchObject({ data_scadenza: '2026-11-01', notes: 'Acconto (Rata 3/3)' });
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd /home/rino/projects/prop-manage-planner && npx vitest run src/utils/incassi.test.ts`
Expected: FAIL — `Failed to resolve import './incassi'` / `buildPaymentRows is not a function`.

- [ ] **Step 3: Implementa l'helper**

```ts
// src/utils/incassi.ts
import { addMonths, format } from 'date-fns';

export interface BuildPaymentRowsParams {
  booking_id: string;
  amount: number;
  date_start: Date;
  months: number;
  category: string;
  description: string;
  is_recurring: boolean;
  already_paid?: boolean;
  payment_method?: string;
  conto_id?: string;
}

export function buildPaymentRows(
  params: BuildPaymentRowsParams,
  userId: string,
  groupId: string | null,
): Record<string, unknown>[] {
  const {
    booking_id, amount, date_start, months, category, description,
    is_recurring, already_paid, payment_method, conto_id,
  } = params;

  if (is_recurring) {
    return Array.from({ length: months }, (_, i) => ({
      booking_id,
      importo: amount,
      data_scadenza: format(addMonths(date_start, i), 'yyyy-MM-dd'),
      category,
      notes: `${description} (Rata ${i + 1}/${months})`,
      stato: 'da_pagare',
      is_recurring: true,
      recurrence_group_id: groupId,
      user_id: userId,
    }));
  }

  const base: Record<string, unknown> = {
    booking_id,
    importo: amount,
    data_scadenza: format(date_start, 'yyyy-MM-dd'),
    category,
    notes: description,
    is_recurring: false,
    recurrence_group_id: null,
    user_id: userId,
  };

  if (already_paid) {
    return [{
      ...base,
      stato: 'pagato',
      payment_date: date_start.toISOString(),
      payment_type: payment_method ?? 'bonifico',
      conto_id: conto_id || null,
    }];
  }

  return [{ ...base, stato: 'da_pagare' }];
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd /home/rino/projects/prop-manage-planner && npx vitest run src/utils/incassi.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
cd /home/rino/projects/prop-manage-planner
git add src/utils/incassi.ts src/utils/incassi.test.ts
git commit -m "feat(incassi): helper puro buildPaymentRows con ramo già pagato"
```

---

### Task 2: Collega `createPaymentPlan` all'helper

Sostituisce il loop inline in `createPaymentPlan` con `buildPaymentRows`, accetta i nuovi params di pagamento e adatta il toast.

**Files:**
- Modify: `src/hooks/useRevenue.ts` (mutation `createPaymentPlan`, ~righe 51-102)

**Interfaces:**
- Consumes: `buildPaymentRows` da `src/utils/incassi.ts`.
- Produces: `createPaymentPlan.mutateAsync` accetta in più `already_paid?: boolean`, `payment_method?: string`, `conto_id?: string`.

- [ ] **Step 1: Aggiungi l'import**

In testa a `src/hooks/useRevenue.ts`, dopo gli import esistenti:

```ts
import { buildPaymentRows } from '@/utils/incassi';
```

- [ ] **Step 2: Sostituisci il corpo di `createPaymentPlan.mutationFn`**

Rimpiazza il blocco da `const { booking_id, amount, ... } = params;` fino a `if (error) throw error;` (incluso il loop `for` e l'`insert`) con:

```ts
      const { booking_id, amount, date_start, months, category, description,
              is_recurring, already_paid, payment_method, conto_id } = params;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utente non loggato. Ricarica la pagina.");
      }

      const groupId = is_recurring ? crypto.randomUUID() : null;
      const rows = buildPaymentRows(
        { booking_id, amount, date_start, months, category, description,
          is_recurring, already_paid, payment_method, conto_id },
        user.id,
        groupId,
      );

      const { error } = await supabase.from('tenant_payments').insert(rows);
      if (error) throw error;
```

E aggiorna la firma dei params della mutation per includere i campi opzionali:

```ts
    mutationFn: async (params: {
        booking_id: string,
        amount: number,
        date_start: Date,
        months: number,
        category: string,
        description: string,
        is_recurring: boolean,
        already_paid?: boolean,
        payment_method?: string,
        conto_id?: string,
    }) => {
```

- [ ] **Step 3: Adatta il toast di successo**

Sostituisci l'`onSuccess` di `createPaymentPlan` con una versione che distingue il caso pagato. Poiché `onSuccess` non riceve i params di default in react-query, usa il secondo argomento (`variables`):

```ts
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['revenue-payments'] });
      const paid = variables.already_paid && !variables.is_recurring;
      toast({
        title: paid ? 'Incasso registrato' : 'Piano Registrato',
        description: paid ? 'Registrato in cassa.' : 'Le scadenze sono state generate.',
      });
    },
```

- [ ] **Step 4: Verifica build/typecheck**

Run: `cd /home/rino/projects/prop-manage-planner && npx vitest run src/utils/incassi.test.ts && npx tsc --noEmit`
Expected: test PASS e `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
cd /home/rino/projects/prop-manage-planner
git add src/hooks/useRevenue.ts
git commit -m "feat(incassi): createPaymentPlan usa buildPaymentRows e accetta campi pagamento"
```

---

### Task 3: Segmented control "Stato" + campi pagamento nel form

Aggiunge il selettore di stato, i campi pagamento condizionali, la validazione e il passaggio dei nuovi campi a `handleCreate`. Nasconde il blocco rateale in modalità "già incassato".

**Files:**
- Modify: `src/components/Revenue.tsx` (state `form` ~riga 201; `handleCreate` ~riga 269; reset; sezione "3. Dettagli" e "Step 4: Ricorrenza" ~righe 608-668)

**Interfaces:**
- Consumes: `createPaymentPlan` (Task 2), `METHOD_OPTIONS` e `conti` già presenti nel file.

- [ ] **Step 1: Estendi lo state `form`**

Modifica l'inizializzazione di `form` (~riga 201) aggiungendo i tre campi:

```tsx
  const [form, setForm] = useState({
    booking_id: '', amount: '', date_start: format(new Date(), 'yyyy-MM-dd'),
    category: 'canone_locazione', description: '', is_recurring: false, months: '12',
    already_paid: false, payment_method: 'bonifico', conto_id: '',
  });
```

Aggiorna anche il reset dentro `handleCreate` (~riga 284) per ripristinare i nuovi campi:

```tsx
    setForm({ booking_id: '', amount: '', date_start: format(new Date(), 'yyyy-MM-dd'), category: 'canone_locazione', description: '', is_recurring: false, months: '12', already_paid: false, payment_method: 'bonifico', conto_id: '' });
```

- [ ] **Step 2: Passa i nuovi campi in `handleCreate`**

Nell'oggetto passato a `createPaymentPlan.mutateAsync` (~riga 274) aggiungi:

```tsx
    await createPaymentPlan.mutateAsync({
      booking_id: form.booking_id,
      amount: parseFloat(form.amount),
      date_start: new Date(form.date_start),
      category: form.category,
      description: form.description || 'Rata canone',
      is_recurring: form.already_paid ? false : form.is_recurring,
      months: parseInt(form.months),
      already_paid: form.already_paid,
      payment_method: form.payment_method,
      conto_id: form.conto_id,
    });
```

- [ ] **Step 3: Aggiungi il segmented control in cima a "3. Dettagli"**

Subito dopo il `<Label>` "3. Dettagli" (~riga 612), prima della griglia Importo/Data, inserisci:

```tsx
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: false, label: 'Da incassare' },
                      { v: true,  label: 'Già incassato' },
                    ].map(opt => (
                      <button
                        key={String(opt.v)}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, already_paid: opt.v, is_recurring: opt.v ? false : f.is_recurring }))}
                        className={`p-2.5 rounded-lg border text-sm font-medium transition-all
                          ${form.already_paid === opt.v ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-400' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
```

- [ ] **Step 4: Rendi dinamica la label della data**

Sostituisci la `<Label className="text-xs">Prima scadenza *</Label>` (~riga 619) con:

```tsx
                      <Label className="text-xs">{form.already_paid ? 'Data ricevuto *' : 'Prima scadenza *'}</Label>
```

- [ ] **Step 5: Blocco pagamento condizionale + nascondi rateale**

Sostituisci l'intero blocco `{/* Step 4: Ricorrenza */}` (dal `<div className="bg-slate-50 border rounded-lg p-3 space-y-3">` fino alla sua chiusura, ~righe 638-657) con una versione che mostra il pagamento se `already_paid`, altrimenti il rateale:

```tsx
                {/* Step 4: Pagamento (già incassato) oppure Ricorrenza */}
                {form.already_paid ? (
                  <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Metodo di pagamento</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {METHOD_OPTIONS.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all
                              ${form.payment_method === m.value ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-400' : 'border-slate-200 hover:bg-slate-50'}`}
                          >
                            {m.icon} {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Conto <span className="text-slate-400 font-normal">(opzionale)</span></Label>
                      <Select value={form.conto_id} onValueChange={v => setForm(f => ({ ...f, conto_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Su quale conto è entrato…" /></SelectTrigger>
                        <SelectContent>
                          {(conti as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 cursor-pointer text-sm">
                        <RefreshCw className="w-4 h-4 text-blue-500" /> Piano rateale mensile
                      </Label>
                      <Switch checked={form.is_recurring} onCheckedChange={c => setForm(f => ({ ...f, is_recurring: c }))} />
                    </div>
                    {form.is_recurring && (
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Numero di rate mensili</Label>
                        <Input type="number" min="2" max="60" value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} className="bg-white" />
                      </div>
                    )}
                    {recurringTotal && (
                      <div className="text-xs bg-blue-50 border border-blue-100 rounded p-2 text-blue-700">
                        📊 Genererà <strong>{form.months} rate</strong> da <strong>€{parseFloat(form.amount || '0').toLocaleString('it-IT')}</strong> / mese → totale <strong>{fmt(recurringTotal)}</strong>
                      </div>
                    )}
                  </div>
                )}
```

- [ ] **Step 6: Etichetta dinamica del pulsante submit**

Sostituisci il testo del bottone di submit (~riga 668) con:

```tsx
                {createPaymentPlan.isPending ? 'Registrazione...' : form.already_paid ? 'Registra incasso' : form.is_recurring ? `Genera ${form.months} rate` : 'Registra'}
```

- [ ] **Step 7: Verifica typecheck, lint e build**

Run: `cd /home/rino/projects/prop-manage-planner && npx tsc --noEmit && npm run lint && npm run build`
Expected: nessun errore TypeScript, lint pulito sui file toccati, build OK.

- [ ] **Step 8: Verifica manuale**

Run: `cd /home/rino/projects/prop-manage-planner && npm run dev`
Nel dialog "Nuovo Incasso": seleziona proprietà+inquilino → in "3. Dettagli" scegli **Già incassato** → verifica che la label data diventi "Data ricevuto", che compaiano Metodo+Conto, che il Piano rateale sparisca, e che "Registra incasso" crei una voce direttamente nel tab **Storico Pagati** con la data/metodo scelti. Poi ripeti con **Da incassare** e verifica il comportamento invariato (compreso il piano rateale).

- [ ] **Step 9: Commit**

```bash
cd /home/rino/projects/prop-manage-planner
git add src/components/Revenue.tsx
git commit -m "feat(incassi): segmented Stato con incasso già ricevuto inline nel form"
```

---

### Task 4: Push su main

- [ ] **Step 1: Verifica suite completa**

Run: `cd /home/rino/projects/prop-manage-planner && npm test && npx tsc --noEmit`
Expected: tutti i test PASS, nessun errore TS.

- [ ] **Step 2: Conferma branch e push**

```bash
cd /home/rino/projects/prop-manage-planner
git status
git log --oneline -4
git push origin HEAD
```

Se HEAD non è `main`, fai prima il merge/fast-forward su `main` secondo il flusso del repo, poi `git push origin main`.
