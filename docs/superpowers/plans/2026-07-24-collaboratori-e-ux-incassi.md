# Collaboratori + UX incassi/spese — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click-to-edit sugli incassi, ordinamento per data in tutte le liste Incassi/Spese, modulo Collaboratori con compensi auto-generati dalle prenotazioni via trigger DB.

**Architecture:** Helper puri testati con vitest (`src/utils/*`), hook TanStack Query (`src/hooks/*`), pagine React shadcn/Tailwind. Migrazione SQL additiva eseguita a mano dall'utente; l'app rileva le feature DB via probe (`src/lib/dbFeatures.ts`) e degrada con grazia se la migrazione manca.

**Tech Stack:** React 18 + Vite, TanStack Query, Supabase JS v2 (client tipato in `src/integrations/supabase/client.ts`, tipi in `src/integrations/supabase/types.ts`), shadcn/ui, vitest.

## Global Constraints

- NON eseguire `npm run build` nei task paralleli (collisioni su dist/): solo `npx vitest run <file>` mirati. Build completa solo nel task di verifica finale.
- NON committare e NON pushare nei task: ci pensa l'orchestratore a fine fase.
- `npx tsc -b` ha errori PRE-esistenti in file non toccati (AddPropertyDialog, AdminNotificationBell, useRevenue:2 errori, GuestPortal, ecc.): un task è pulito se `npx tsc -b 2>&1 | grep <file-toccato>` non mostra errori NUOVI.
- Il DB di produzione NON ha ancora: `tenant_payments.property_id` (migrazione 2026-07-20 pendente) né le tabelle collaboratori. Ogni query verso tabelle/colonne nuove passa dal probe di `src/lib/dbFeatures.ts` (pattern esistente `hasIncassiLiberi()`).
- Select Supabase con stringhe template (dinamiche) rompono il parser tipato: chiudere la catena con `.returns<any[]>()` DOPO i `.eq()` (pattern già usato in `src/pages/Cassa.tsx`).
- Stile: design system Iris/Indaco esistente (tokens.css / design.md); componenti shadcn già importati nelle pagine; nessun nuovo font/colore globale.
- Testi UI in italiano.

---

### Task 1: Fondamenta — migrazione SQL, tipi, probe, ordinamenti

**Files:**
- Create: `supabase/migrations/20260724_collaboratori.sql`
- Modify: `src/integrations/supabase/types.ts` (tabelle `collaboratori`, `collaboratori_condizioni`; colonne `collaboratore_id`, `source_booking_id` su `payments`)
- Modify: `src/lib/dbFeatures.ts` (aggiungi `hasCollaboratori()`)
- Modify: `src/utils/scadenze.ts` (ordinamenti dentro `bucketByScadenza`)
- Create: `src/utils/ordinamento.test.ts` (test ordinamenti)

**Interfaces:**
- Produces: `hasCollaboratori(): Promise<boolean>` (probe cached su `collaboratori` select id limit 1, come `hasIncassiLiberi`).
- Produces: `bucketByScadenza` invariato nella firma, ma con garanzie di ordinamento: `overdue`, `thisMonth`, `later` e `DayGroup.items` ordinati per data crescente; `paid` ordinato per `payment_date ?? data_pagamento ?? scadenza` decrescente.

- [ ] **Step 1: migrazione SQL** — contenuto esatto del file `supabase/migrations/20260724_collaboratori.sql`:

```sql
-- Collaboratori (keyholder / addetti pulizie) e condizioni di compenso.
CREATE TABLE IF NOT EXISTS public.collaboratori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nome text NOT NULL,
  telefono text,
  note text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collaboratori_condizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboratore_id uuid NOT NULL REFERENCES public.collaboratori(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties_real(id) ON DELETE CASCADE, -- NULL solo per tipo='mensile'
  tipo text NOT NULL CHECK (tipo IN ('checkin','pulizia','mensile')),
  importo numeric(10,2) NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.collaboratori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboratori_condizioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON public.collaboratori
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON public.collaboratori_condizioni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS collaboratore_id uuid REFERENCES public.collaboratori(id),
  ADD COLUMN IF NOT EXISTS source_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_collaboratore ON public.payments(collaboratore_id);

-- Trigger: alla creazione di una prenotazione genera i compensi checkin/pulizia.
CREATE OR REPLACE FUNCTION public.genera_compensi_collaboratori()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.payments
    (importo, importo_originale, descrizione, categoria, scadenza, stato, competence,
     user_id, property_real_id, collaboratore_id, source_booking_id, payment_method)
  SELECT c.importo, c.importo,
         'Compenso ' || col.nome || ' — ' ||
           CASE c.tipo WHEN 'checkin' THEN 'check-in' ELSE 'pulizia' END ||
           ' ' || COALESCE(NULLIF(TRIM(NEW.nome_ospite), ''), 'prenotazione'),
         'altro',
         CASE c.tipo WHEN 'checkin' THEN NEW.data_inizio ELSE COALESCE(NEW.data_fine, NEW.data_inizio) END,
         'da_pagare', 'owner',
         NEW.user_id, NEW.property_id, c.collaboratore_id, NEW.id, 'contanti'
  FROM public.collaboratori_condizioni c
  JOIN public.collaboratori col ON col.id = c.collaboratore_id
  WHERE c.property_id = NEW.property_id AND c.attivo AND col.attivo
    AND c.tipo IN ('checkin','pulizia');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_genera_compensi ON public.bookings;
CREATE TRIGGER trg_genera_compensi AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.genera_compensi_collaboratori();

-- Trigger: alla cancellazione della prenotazione rimuove i compensi non ancora pagati.
CREATE OR REPLACE FUNCTION public.pulisci_compensi_collaboratori()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.payments
   WHERE source_booking_id = OLD.id AND collaboratore_id IS NOT NULL AND stato = 'da_pagare';
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pulisci_compensi ON public.bookings;
CREATE TRIGGER trg_pulisci_compensi BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.pulisci_compensi_collaboratori();
```

Nota: verificare in `supabase_dump.sql` i nomi colonna reali di `payments` (`importo_originale`, `categoria`, `scadenza`, `competence`, `payment_method`) e `bookings` (`nome_ospite`, `data_inizio`, `data_fine`, `property_id`, `user_id`); correggere la SQL se differiscono.

- [ ] **Step 2: tipi** — in `types.ts` aggiungere le due tabelle (Row/Insert/Update/Relationships) e le colonne su `payments` seguendo ESATTAMENTE lo stile del file (vedi blocco `tenant_payments` per il pattern, incluse le FK in Relationships).
- [ ] **Step 3: probe** — in `dbFeatures.ts` aggiungere `hasCollaboratori()` con cache separata, stesso pattern di `hasIncassiLiberi()`.
- [ ] **Step 4 (TDD): test ordinamenti** — creare `src/utils/ordinamento.test.ts` PRIMA dell'implementazione: `bucketByScadenza` con item volutamente in disordine → attesi `overdue`/`thisMonth`/`later`/`DayGroup.items` crescenti per scadenza e `paid` decrescente per `payment_date ?? data_pagamento ?? scadenza`. Eseguire: `npx vitest run src/utils/ordinamento.test.ts` → FAIL.
- [ ] **Step 5: implementare gli ordinamenti** in `bucketByScadenza` (sort stabile su stringhe ISO `slice(0,10)`), rieseguire → PASS.
- [ ] **Step 6: suite completa** — `npx vitest run` → tutti verdi; `npx tsc -b 2>&1 | grep -E "scadenze|dbFeatures|types"` → vuoto.

---

### Task 2: Incassi — click-to-edit + ordinamenti (`src/components/Revenue.tsx`)

**Files:**
- Modify: `src/components/Revenue.tsx`

**Interfaces:**
- Consumes: `bucketByScadenza` ordinato (Task 1). `groupByMonth` è locale a Revenue.tsx: ordinare `items` per `payment_date` decrescente dentro la funzione.

- [ ] **Step 1**: in `RevenueRow` aggiungere prop `onRowClick?: () => void`; il contenitore riga (`div` radice) diventa cliccabile (`onClick={onRowClick}`, `cursor-pointer` quando presente). Su TUTTI i controlli interni (bottone Incassa, select conto, calendario, matita, cestino) aggiungere `e.stopPropagation()` nel loro onClick/onValueChange wrapper per non aprire la modifica per sbaglio.
- [ ] **Step 2**: nelle 5 istanze di `<RevenueRow>` passare `onRowClick={() => handleEdit(r)}` — ANCHE nel tab Incassati (che oggi non ha matita).
- [ ] **Step 3**: `groupByMonth`: dopo il grouping, `map[key].sort((a,b) => (b.payment_date||b.data_scadenza||'').localeCompare(a.payment_date||a.data_scadenza||''))`.
- [ ] **Step 4**: verifica — `npx vitest run` verde; `npx tsc -b 2>&1 | grep "components/Revenue"` vuoto (i 2 errori in `hooks/useRevenue.ts` sono PRE-esistenti: non toccarli, non contarli).

---

### Task 3: Spese — ordinamenti + badge collaboratore (`src/pages/Expenses.tsx`)

**Files:**
- Modify: `src/pages/Expenses.tsx`

**Interfaces:**
- Consumes: `bucketByScadenza` ordinato (Task 1), `hasCollaboratori()` (Task 1).
- La query spese vive in `useUnifiedExpenses`/queryKey `unified-expenses` (individuarla: `grep -rn "unified-expenses" src/`). Aggiungere all'elenco select `collaboratore_id` e l'embed `collaboratori(nome)` SOLO se `await hasCollaboratori()` è true (select con template string + `.returns<any[]>()` in coda alla catena).

- [ ] **Step 1**: ordinamenti — `groupByMonth` locale (vedi `groupedPaid`): ordinare dentro i gruppi per `data_pagamento` decrescente; verificare che le liste aperte usino i bucket ordinati del Task 1 senza ri-mischiare.
- [ ] **Step 2**: in `ExpenseRow`, se `exp.collaboratori?.nome` presente → badge `🧹 <nome>` (pill `bg-indigo-50 border-indigo-100 text-indigo-700`, come i badge proprietà esistenti).
- [ ] **Step 3**: click-to-edit anche qui: riga cliccabile → `openEdit(ex)` con `stopPropagation` sui controlli interni (stesso pattern del Task 2, la pagina ha già `onEdit`).
- [ ] **Step 4**: verifica — `npx vitest run` verde; `npx tsc -b 2>&1 | grep "pages/Expenses"` vuoto.

---

### Task 4: Modulo Collaboratori — hook + pagina + navigazione

**Files:**
- Create: `src/hooks/useCollaboratori.ts`
- Create: `src/pages/Collaboratori.tsx`
- Modify: `src/App.tsx` (route `collaboratori`)
- Modify: `src/components/Sidebar.tsx` (voce "Collaboratori" nella sezione GESTIONE, icona lucide `Users` o `KeyRound`)

**Interfaces:**
- Consumes: `hasCollaboratori()` (Task 1), tipi Task 1.
- Produces (hook): `useCollaboratori()` → `{ collaboratori, condizioni, compensi, isLoading, ready, addCollaboratore, updateCollaboratore, addCondizione, toggleCondizione, ensureMensili }` dove:
  - `ready: boolean` = migrazione presente (da `hasCollaboratori()`, via `useQuery`);
  - `compensi`: payments con `collaboratore_id not null` → select `id, importo, stato, scadenza, data_pagamento, descrizione, collaboratore_id, properties_real(nome)`;
  - `ensureMensili()`: per ogni condizione `tipo='mensile'` attiva senza payment del mese corrente (`descrizione = 'Compenso <nome> — mensile <yyyy-MM>'`), inserisce la spesa `da_pagare` con `scadenza` = 1° del mese, `categoria 'altro'`, `competence 'owner'`, `payment_method 'contanti'`, `user_id` dell'utente loggato. Idempotente per descrizione+mese. Chiamata una volta al mount della pagina quando `ready`.

- [ ] **Step 1**: hook con le query sopra; tutte le query sotto guardia `ready` (`enabled: ready === true`); mutations con invalidate di `['collaboratori']`, `['collaboratori-compensi']`, `['unified-expenses']`.
- [ ] **Step 2**: pagina — se `!ready`: card avviso "Modulo non ancora attivo: esegui la migrazione `supabase/migrations/20260724_collaboratori.sql` nel SQL Editor di Supabase" e stop. Se ready: elenco card collaboratore (nome, telefono, KPI **Maturato / Pagato / Da pagare** calcolati dai compensi: maturato = somma importi, pagato = somma stato='pagato', da pagare = differenza), dialog "Nuovo collaboratore" (nome*, telefono, note), sezione condizioni per collaboratore (righe: proprietà — o "Generale (mensile)" — tipo, importo, switch attivo; dialog aggiungi condizione con select proprietà da `usePropertiesReal()`, select tipo checkin/pulizia/mensile — proprietà nascosta e null se mensile, input importo), storico voci del collaboratore (tabella data · descrizione · importo · stato) collassabile.
- [ ] **Step 3**: route in `App.tsx` accanto a `team` + voce Sidebar sotto GESTIONE.
- [ ] **Step 4**: verifica — `npx vitest run` verde; `npx tsc -b 2>&1 | grep -E "Collaboratori|useCollaboratori|Sidebar|App.tsx"` vuoto.

---

### Task 5: Verifica finale (dopo merge dei task)

- [ ] `npx vitest run` → tutta la suite verde.
- [ ] `npx tsc -b 2>&1 | grep -E "<ogni file toccato>"` → nessun errore nuovo (baseline pre-esistente esclusa).
- [ ] `npm run build` → `✓ built`.
- [ ] Review adversariale del diff completo (`git diff main`): bug reali, regressioni su flussi esistenti (creazione spesa/incasso, estratti, cassa), resilienza pre-migrazione (l'app DEVE funzionare con il DB attuale privo di property_id e collaboratori).
- [ ] Commit + push su main (orchestratore).
