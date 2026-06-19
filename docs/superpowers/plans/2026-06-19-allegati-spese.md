# Allegati Spese (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere di caricare e visualizzare un allegato (PDF o immagine) per ogni spesa, dall'interfaccia delle spese.

**Architecture:** Nessuna migrazione DB. Si riusano la colonna `payments.allegato_url` (che conterrà il *path* del file nel bucket storage `documents`) e il bucket `documents` esistente. La logica pura (validazione tipo, costruzione path, nome visualizzato) vive in un util testato; le chiamate storage e la UI vivono in `src/pages/Expenses.tsx`, seguendo il pattern già usato in `TenantPortal.tsx` (upload del path + apertura via signed URL temporanea).

**Tech Stack:** React + TypeScript, Supabase Storage, vitest, lucide-react, shadcn/ui.

**Spec di riferimento:** `docs/superpowers/specs/2026-06-19-allegati-spese-design.md`

---

## File Structure

- **Create** `src/utils/allegato.ts` — helper puri: `isAllegatoTypeValid`, `buildAllegatoPath`, `displayNameFromPath`, costante `ALLEGATO_MAX_BYTES`.
- **Create** `src/utils/allegato.test.ts` — unit test dei helper puri.
- **Modify** `src/pages/Expenses.tsx` — funzione modulo `openAllegato`, stato/handler di upload, campo allegato nel form, icona graffetta nella riga spesa, `allegato_url` nel payload di salvataggio.

---

## Task 1: Helper puri per gli allegati

**Files:**
- Create: `src/utils/allegato.ts`
- Test: `src/utils/allegato.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/allegato.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isAllegatoTypeValid,
  buildAllegatoPath,
  displayNameFromPath,
  ALLEGATO_MAX_BYTES,
} from './allegato';

describe('isAllegatoTypeValid', () => {
  it('accetta PDF e immagini', () => {
    expect(isAllegatoTypeValid({ type: 'application/pdf' })).toBe(true);
    expect(isAllegatoTypeValid({ type: 'image/jpeg' })).toBe(true);
    expect(isAllegatoTypeValid({ type: 'image/png' })).toBe(true);
  });
  it('rifiuta altri tipi', () => {
    expect(isAllegatoTypeValid({ type: 'text/plain' })).toBe(false);
    expect(isAllegatoTypeValid({ type: 'application/zip' })).toBe(false);
  });
});

describe('buildAllegatoPath', () => {
  it('usa prefisso spese/, timestamp e sostituisce gli spazi', () => {
    expect(buildAllegatoPath('Fattura TARI.pdf', 1718800000000))
      .toBe('spese/1718800000000_Fattura_TARI.pdf');
  });
});

describe('displayNameFromPath', () => {
  it('rimuove cartella e prefisso timestamp', () => {
    expect(displayNameFromPath('spese/1718800000000_Fattura_TARI.pdf'))
      .toBe('Fattura_TARI.pdf');
  });
  it('gestisce un path senza prefisso', () => {
    expect(displayNameFromPath('Documento.pdf')).toBe('Documento.pdf');
  });
});

describe('ALLEGATO_MAX_BYTES', () => {
  it('vale 10 MB', () => {
    expect(ALLEGATO_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/allegato.test.ts`
Expected: FAIL — il modulo `./allegato` non esiste ancora.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/allegato.ts`:

```ts
/** Dimensione massima consentita per un allegato spesa: 10 MB. */
export const ALLEGATO_MAX_BYTES = 10 * 1024 * 1024;

/** Accetta solo PDF o immagini. */
export function isAllegatoTypeValid(file: { type: string }): boolean {
  return file.type === 'application/pdf' || file.type.startsWith('image/');
}

/**
 * Costruisce il path nel bucket `documents` per l'allegato di una spesa.
 * Formato: `spese/{timestamp}_{nome sanificato}`.
 * `nowMs` è iniettabile per i test.
 */
export function buildAllegatoPath(fileName: string, nowMs: number = Date.now()): string {
  const safe = fileName.replace(/\s+/g, '_');
  return `spese/${nowMs}_${safe}`;
}

/** Deriva un nome leggibile dal path salvato (rimuove cartella e prefisso timestamp). */
export function displayNameFromPath(path: string): string {
  const last = path.split('/').pop() || path;
  return last.replace(/^\d+_/, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/allegato.test.ts`
Expected: PASS (tutti i test verdi).

- [ ] **Step 5: Commit**

```bash
git add src/utils/allegato.ts src/utils/allegato.test.ts
git commit -m "feat(spese): helper puri per gli allegati"
```

---

## Task 2: Integrazione upload + visualizzazione in Expenses.tsx

**Files:**
- Modify: `src/pages/Expenses.tsx`

Tutti gli step di questo task modificano lo stesso file. La verifica è via typecheck + test esistenti (nessun nuovo unit test: è UI/storage), poi verifica manuale nel Task 3.

- [ ] **Step 1: Aggiungere le icone e l'import dei helper**

In `src/pages/Expenses.tsx`, l'import da `lucide-react` (righe 20-25) elenca le icone. Aggiungere `Paperclip, Loader2, X, ExternalLink` alla lista. Il blocco diventa:

```tsx
import {
  CheckCircle, Clock, AlertTriangle, TrendingDown,
  Pencil, Plus, Trash2,
  ChevronDown, ChevronUp, CreditCard, Banknote, Building2, Smartphone,
  Filter, Home, Car, Euro, User, Eye, HandCoins, Undo2,
  Paperclip, Loader2, X, ExternalLink,
} from 'lucide-react';
```

Subito sotto l'import di `bucketByScadenza` (riga 31), aggiungere:

```tsx
import { isAllegatoTypeValid, buildAllegatoPath, displayNameFromPath, ALLEGATO_MAX_BYTES } from '@/utils/allegato';
```

- [ ] **Step 2: Aggiungere la funzione modulo `openAllegato`**

Apre un allegato in una nuova scheda tramite signed URL temporanea. È a livello di modulo così la usano sia la riga spesa sia il form, senza dipendere da hook.

Inserirla subito dopo il blocco import (dopo la riga dell'import di `allegato`, prima di `// ─── constants`):

```tsx
// Apre un allegato (path nel bucket documents) in una nuova scheda via signed URL.
async function openAllegato(path: string) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    console.error('Errore apertura allegato:', error);
    alert("Impossibile aprire l'allegato.");
    return;
  }
  window.open(data.signedUrl, '_blank');
}
```

- [ ] **Step 3: Mostrare la graffetta nella riga spesa**

Nel componente `ExpenseRow`, nella colonna destra, c'è il blocco `{onEdit && (...)}` (righe ~180-184). Inserire SUBITO PRIMA di quel blocco:

```tsx
        {exp.allegato_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 text-slate-400 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => openAllegato(exp.allegato_url)}
            title="Apri allegato"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
        )}
```

(`exp` è già una prop di `ExpenseRow` e la query spese fa `select('*')`, quindi `allegato_url` è disponibile.)

- [ ] **Step 4: Aggiungere `allegato_url` allo stato del form**

In `DEFAULT_FORM` (riga ~210 termina con `conto_id: '',`), aggiungere come ultima proprietà:

```tsx
  conto_id: '',
  allegato_url: '',
```

- [ ] **Step 5: Aggiungere lo stato locale di upload**

Vicino agli altri `useState` di UI nel componente `Expenses` (dopo `const [search, setSearch] = useState('');`), aggiungere:

```tsx
  const [uploadingAllegato, setUploadingAllegato] = useState(false);
```

- [ ] **Step 6: Precaricare `allegato_url` in modifica**

In `openEdit`, l'oggetto passato a `setForm` termina con `conto_id: exp.conto_id || '',` (riga ~375). Aggiungere subito dopo:

```tsx
      conto_id: exp.conto_id || '',
      allegato_url: exp.allegato_url || '',
```

- [ ] **Step 7: Includere `allegato_url` nel payload di salvataggio**

In `saveExpense.mutationFn`, il `payload` contiene `conto_id: form.conto_id || null,` (riga ~296). Aggiungere subito dopo:

```tsx
        conto_id: form.conto_id || null,
        allegato_url: form.allegato_url || null,
```

- [ ] **Step 8: Aggiungere gli handler di upload/rimozione nel componente**

Vicino agli altri handler del componente (es. dopo `openEdit`/`openCreate`), aggiungere:

```tsx
  const handleAllegatoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // consente di ricaricare lo stesso file in seguito
    if (!file) return;
    if (!isAllegatoTypeValid(file)) {
      toast({ title: 'Formato non supportato', description: "Carica un PDF o un'immagine.", variant: 'destructive' });
      return;
    }
    if (file.size > ALLEGATO_MAX_BYTES) {
      toast({ title: 'File troppo grande', description: 'Dimensione massima 10 MB.', variant: 'destructive' });
      return;
    }
    setUploadingAllegato(true);
    try {
      // Sostituzione: elimina (best-effort) il file precedente prima del nuovo upload.
      if (form.allegato_url) {
        await supabase.storage.from('documents').remove([form.allegato_url]);
      }
      const path = buildAllegatoPath(file.name);
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) throw error;
      setForm(f => ({ ...f, allegato_url: path }));
    } catch (err: any) {
      toast({ title: 'Errore caricamento', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAllegato(false);
    }
  };

  const handleAllegatoRemove = async () => {
    const path = form.allegato_url;
    setForm(f => ({ ...f, allegato_url: '' }));
    if (path) {
      try { await supabase.storage.from('documents').remove([path]); } catch { /* best-effort */ }
    }
  };
```

- [ ] **Step 9: Aggiungere il campo Allegato nel form**

Nel form (Sheet), c'è il blocco `{/* Conto — solo quando la spesa è già pagata */}` che si chiude alla riga ~889. Inserire SUBITO DOPO quel blocco (e prima di `{/* Inoltra all'inquilino ... */}`):

```tsx
            {/* Allegato (giustificativo) */}
            <div className="grid gap-1.5">
              <Label className="text-sm sm:text-xs">Allegato (fattura/ricevuta)</Label>
              {form.allegato_url ? (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm truncate flex-1">{displayNameFromPath(form.allegato_url)}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={() => openAllegato(form.allegato_url)}>
                    <ExternalLink className="w-3.5 h-3.5" />Apri
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={handleAllegatoRemove}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative">
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleAllegatoSelect}
                    disabled={uploadingAllegato}
                  />
                  {uploadingAllegato ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />Caricamento…
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Paperclip className="w-4 h-4" />Carica PDF o immagine (max 10 MB)
                    </div>
                  )}
                </div>
              )}
            </div>
```

- [ ] **Step 10: Disabilitare Salva durante l'upload**

Nel bottone di salvataggio (riga ~930) la prop è `disabled={!form.importo || saveExpense.isPending}`. Sostituirla con:

```tsx
                disabled={!form.importo || saveExpense.isPending || uploadingAllegato}
```

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 12: Eseguire la suite di test (nessuna regressione)**

Run: `npm test`
Expected: PASS (inclusi i test del Task 1).

- [ ] **Step 13: Commit**

```bash
git add src/pages/Expenses.tsx
git commit -m "feat(spese): carica e visualizza un allegato per spesa"
```

---

## Task 3: Verifica manuale sul deploy

**Files:** nessuno (solo verifica).

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Verificare il flusso completo nell'app live**

Sul deploy, controllare nell'ordine:
1. **Nuova Spesa** → caricare un PDF: durante l'upload appare "Caricamento…" e Salva è disabilitato; poi compaiono nome file + **Apri** + **X**.
2. **Apri** apre il PDF in una nuova scheda.
3. Salvare la spesa → nell'elenco la riga mostra l'icona **graffetta**; cliccandola si apre il file.
4. Riaprire la spesa in **Modifica** → l'allegato è ancora presente.
5. **X** rimuove l'allegato; dopo il salvataggio la graffetta sparisce dalla riga.
6. Caricare un allegato, poi sostituirlo con un altro file → **Apri** mostra il nuovo file.
7. Provare un file non valido (es. `.zip`) → toast "Formato non supportato"; un file > 10 MB → toast "File troppo grande".

---

## Fuori scope (Fase 2)

Link cliccabili ai giustificativi dentro l'estratto conto PDF e supporto a più
allegati per spesa: da progettare in uno spec separato. La nota sicurezza sul
bucket pubblico (`documents`) resta da affrontare in futuro.

---

## Self-Review

- **Spec coverage:** convenzione path/signed URL (Task 2 Step 2, 8); upload nel form (Step 9); validazione tipo+dimensione (Step 8 + Task 1); Apri/Rimuovi/Sostituzione (Step 8, 9); graffetta nella card (Step 3); payload salvataggio + preload modifica (Step 6, 7); gestione errori via toast (Step 8); fuori scope annotato. Tutte le sezioni dello spec hanno un task corrispondente.
- **Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice completo.
- **Type consistency:** `allegato_url` aggiunto coerentemente a `DEFAULT_FORM`, `openEdit` e payload; helper `isAllegatoTypeValid`/`buildAllegatoPath`/`displayNameFromPath`/`ALLEGATO_MAX_BYTES` usati con le firme definite nel Task 1; `openAllegato(path: string)` usato in modo coerente in `ExpenseRow` e nel form.
