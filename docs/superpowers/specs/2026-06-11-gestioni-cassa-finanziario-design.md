# Design — Gestioni, Cassa & Migliorie Finanziario

**Data:** 2026-06-11
**Stato:** Approvato (design), pronto per writing-plans
**Esecuzione prevista:** subagent-driven development (piano unico, approccio "tutto in un colpo")

## Contesto e problema

La sezione Finanziario (`src/pages/Expenses.tsx` = Spese, `src/components/Revenue.tsx` = Incassi) ha questi limiti, segnalati dall'utente:

1. **Nessuna barra di ricerca** in Spese/Incassi: impossibile ritrovare una voce appena inserita.
2. **Le scadenze di "oggi" spariscono.** Bug confermato nel codice: una voce con `scadenza = oggi` risulta `isPast` (scatta a mezzanotte) quindi è esclusa da "in scadenza" (`!isPast` falso), ma è anche esclusa da "scadute" (`!isToday` falso). Cade nel vuoto tra i due bucket.
3. **Nessuna situazione di cassa/liquidità aggiornata.** I KPI sommano pagato/in attesa ma non esiste saldo dei conti.
4. **Nessun export** dell'estratto conto.
5. **Nessuna separazione per intestatario.** Le proprietà immobiliari (`properties_real`) non hanno campo proprietario/gestione. Serve dividere le proprietà di "Io & Mamma" da quelle dei "Nonni", ciascun gruppo con la propria cassa ed estratto conto.

Stack: React + Vite + TypeScript + shadcn/ui + Supabase + TanStack Query. PDF già disponibili in dipendenze (`jspdf`, `@react-pdf/renderer`).

## Decisioni prese (brainstorming)

- **Gestioni**: 2 gruppi **fissi** — "Io & Mamma" e "Nonni". Ogni proprietà appartiene a una sola gestione.
- **Cassa**: saldo reale con apertura **+** più conti per gestione (contanti + banche). Ogni conto ha un saldo iniziale.
- **Conti per gestione**: ogni conto appartiene a una sola gestione.
- **Conto sui movimenti**: la scelta "metodo pagamento" viene **sostituita** dalla scelta del conto reale.
- **Giroconto**: terzo tipo di movimento (sposta tra conti, non è incasso né spesa).
- **Piano A (saldo da data)**: il saldo iniziale vale a una `data_apertura`; solo i movimenti **con data ≥ data_apertura** muovono il saldo. Niente ricostruzione totale dello storico. I movimenti vecchi senza conto restano visibili ma fuori dalla cassa.
- **Estratto conto**: PDF, **per gestione** e **per proprietà**, periodo selezionabile.
- **Filtro gestione**: a tendina **per pagina** (non interruttore globale).
- **Scadenze**: oggi rientra in "Questa settimana"; "Questa settimana" suddivisa **per giorno**; "Prossimi 30gg" e "Oltre 30gg" restano liste piatte. Vale per Spese **e** Incassi.

## Architettura

### 1. Modello dati (Supabase, migration)

Nuove tabelle:

- **`gestioni`** — seed 2 righe fisse, non creabili da UI.
  - `id` (uuid, pk), `nome` (text), `colore` (text), `created_at`.
  - Seed: "Io & Mamma", "Nonni".
- **`conti`**
  - `id` (uuid, pk), `gestione_id` (fk → gestioni), `nome` (text), `tipo` (text: `contanti` | `banca`), `saldo_iniziale` (numeric, default 0), `data_apertura` (date), `user_id` (uuid), `archived` (bool default false), `created_at`.
- **`giroconti`**
  - `id` (uuid, pk), `conto_from` (fk → conti), `conto_to` (fk → conti), `importo` (numeric), `data` (date), `descrizione` (text null), `user_id` (uuid), `created_at`.

Modifiche a tabelle esistenti:

- `properties_real`: + `gestione_id` (fk → gestioni, nullable).
- `properties_mobile`: + `gestione_id` (fk → gestioni, nullable).
- `payments` (spese): + `conto_id` (fk → conti, nullable).
- `tenant_payments` (incassi): + `conto_id` (fk → conti, nullable).

> **Nota tabelle:** la pagina Incassi (`Revenue.tsx` via `useRevenue`) usa **`tenant_payments`**, non `income` (quest'ultima non è esposta in UI ed è fuori scope). Le spese (`payments`) sono legate alla proprietà direttamente (`property_real_id` / `property_mobile_id`); gli incassi (`tenant_payments`) sono legati alla proprietà **indirettamente** via `booking_id → bookings.property_id → properties_real`. Il filtro gestione e l'estratto conto per proprietà devono seguire questo join per gli incassi.

RLS: coerente con le policy esistenti (per `user_id`). Aggiornare `src/integrations/supabase/types.ts` dopo la migration.

### 2. Logica di calcolo cassa

Per ogni conto:

```
saldo_attuale = saldo_iniziale
  + Σ incassi pagati  (tenant_payments.conto_id = conto, payment_date ≥ data_apertura)
  − Σ spese pagate    (conto_id = conto, data_pagamento ≥ data_apertura)
  + Σ giroconti in    (conto_to   = conto, data ≥ data_apertura)
  − Σ giroconti out   (conto_from = conto, data ≥ data_apertura)
```

Regole:
- Solo movimenti **pagati/incassati** muovono la cassa (i `da_pagare` no).
- Movimenti con `conto_id` null non rientrano in nessun saldo.
- Cassa gestione = somma dei saldi dei suoi conti. Liquidità totale = somma di tutte le gestioni.

Implementazione: hook dedicato (es. `src/hooks/useCassa.ts`) che aggrega lato client (volumi piccoli), oppure una view/funzione SQL se preferibile in fase di piano. Default: aggregazione client con TanStack Query.

### 3. Fix scadenze + ricerca

In `Expenses.tsx` e `Revenue.tsx`:
- **Fix oggi**: `upcoming` include oggi (`!isPast(scadenza) || isToday(scadenza)`); `overdue` resta `isPast && !isToday`. Nessuna voce cade nel vuoto.
- **"Questa settimana" per giorno**: raggruppa le voci di `thisWeek` per data (`yyyy-MM-dd`), una sotto-sezione per giornata con etichetta giorno (oggi → "Oggi — <data>"), ordinate cronologicamente. Solo i giorni con voci.
- **Barra di ricerca**: input testo in cima alla pagina; filtra in **tutte le tab** per `descrizione`, nome proprietà, nome inquilino, `importo` (match testuale), `fornitore`/`note` dove presenti. Combinabile con i filtri esistenti.

### 4. Gestioni & filtro

- Form proprietà (immobile e veicolo): selettore gestione (obbligatorio in creazione).
- Filtro a tendina (Tutte / Io&Mamma / Nonni) in Spese, Incassi, Cassa. Filtra tramite la gestione della proprietà del movimento.

### 5. Movimenti

- **Spese/Incassi**: il selettore "metodo pagamento" (bonifico/contanti/carta…) è sostituito dalla **scelta del conto**. Nei dialog "Conferma pagamento"/"Conferma incasso" si sceglie il conto su cui registrare. I conti mostrati sono filtrati per la gestione della proprietà.
- **Giroconto**: dalla pagina Cassa — form da conto → a conto + importo + data + nota. Crea riga in `giroconti`.

### 6. Pagina Cassa (nuova)

Voce in sidebar gruppo "Finanziario" (`src/components/Sidebar.tsx`), nuova route + pagina.
- KPI: Liquidità totale, totale per gestione.
- Per ogni gestione: lista conti con saldo attuale.
- Azioni: nuovo conto, modifica saldo iniziale / data apertura, giroconto, download estratto conto (gestione o proprietà).
- Filtro gestione a tendina.

### 7. Estratto conto PDF

- **Per gestione**: sezionato per conto; ogni conto = mini estratto con saldo iniziale → righe movimenti (entrata/uscita) → saldo progressivo → totali del conto.
- **Per proprietà**: tutti i movimenti della proprietà nel periodo; "saldo progressivo" = flusso netto cumulato (entrate − uscite) della proprietà.
- Colonne riga: data · descrizione · proprietà · conto · entrata/uscita · saldo progressivo.
- Selettore periodo: mese / anno / intervallo personalizzato / tutto.
- Generazione con `@react-pdf/renderer`, coerente con il pattern esistente di `src/components/TicketPDF.tsx`.

### 8. Migrazione / setup iniziale

- Migration crea tabelle e fa seed delle 2 gestioni.
- Al primo utilizzo l'utente: assegna le proprietà alle gestioni, crea i conti con saldo iniziale e data apertura.
- I movimenti storici restano con `conto_id` null (fuori cassa) finché non assegnati; nessuna assegnazione in blocco obbligatoria.

## Componenti / unità (confini)

- `supabase/migrations/<ts>_gestioni_cassa.sql` — schema + seed.
- `src/hooks/useGestioni.ts` — lista gestioni.
- `src/hooks/useConti.ts` — CRUD conti.
- `src/hooks/useCassa.ts` — calcolo saldi (conto, gestione, totale).
- `src/hooks/useGiroconti.ts` — CRUD giroconti.
- `src/pages/Cassa.tsx` — pagina cassa.
- `src/components/EstrattoContoPDF.tsx` — documento PDF.
- `src/components/GirocontoDialog.tsx`, `src/components/ContoDialog.tsx` — dialog conti/giroconti.
- Modifiche: `Expenses.tsx`, `Revenue.tsx` (ricerca, fix scadenze, scelta conto, filtro gestione), `Sidebar.tsx` (voce Cassa), form proprietà (campo gestione), `App.tsx` (route).

## Testing

- Logica cassa: test unit sul calcolo saldo (apertura, soglia data, solo pagati, giroconti).
- Fix scadenze: test che una voce con `scadenza = oggi` finisca in "Questa settimana" e non sparisca; raggruppamento per giorno.
- Ricerca: filtra correttamente su tutti i campi e in tutte le tab.
- Estratto conto: saldo progressivo coerente con totali; periodo rispettato.

## Fuori scope (YAGNI)

- Quote/comproprietà percentuali (gestioni condivise).
- Interruttore gestione globale.
- Estratto conto per singolo conto (solo gestione + proprietà).
- Riconciliazione bancaria automatica / import estratti banca.
- Assegnazione in blocco dei movimenti storici (resta manuale/facoltativa).
