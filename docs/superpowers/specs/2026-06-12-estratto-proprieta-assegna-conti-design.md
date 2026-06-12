# Design — Estratto conto per proprietà & Assegnazione movimenti senza conto

**Data:** 2026-06-12
**Stato:** Approvato (design), pronto per writing-plans
**Contesto:** estende il sistema Gestioni & Cassa introdotto il 2026-06-11 (vedi `2026-06-11-gestioni-cassa-finanziario-design.md`).

## Problema / obiettivo

Due rifiniture rimaste fuori dal primo rilascio:

1. **Estratto conto per singola proprietà** — oggi l'estratto PDF si scarica solo per gestione (`Cassa.tsx` → `EstrattoDialog` + `buildEstrattoGestione`). Serve poterlo scaricare anche per una singola proprietà.
2. **Assegnazione in blocco dei movimenti senza conto** — i movimenti realizzati registrati senza `conto_id` (es. storico, o registrazioni veloci) restano fuori dalla cassa. Serve uno strumento per assegnarli a un conto in blocco, così la cassa rispecchia la realtà.

Stack invariato: React + Vite + TS + shadcn/ui + Supabase + TanStack Query + `@react-pdf/renderer`. Tabelle: spese in `payments`, incassi in `tenant_payments`, conti in `conti`, ognuno con `conto_id` (nullable) sui movimenti e `gestione_id` sulle proprietà.

## Decisioni prese (brainstorming)

- Estratto per proprietà: lanciato **dalla pagina Cassa**, interruttore **Gestione / Proprietà** nello stesso `EstrattoDialog`.
- Estratto per proprietà: **solo movimenti realizzati** (spese pagate + incassi incassati); il previsto arriverà con la futura funzione cashflow.
- Estratto per proprietà: mostra **tutti** i movimenti della proprietà, anche quelli **senza conto** (colonna Conto = "—"). Saldo progressivo da **0** (netto cumulato).
- Assegnazione: strumento **nella pagina Cassa** (banner + dialog). Mostra **solo movimenti realizzati senza conto**.
- Assegnazione: modello **C** — selezione multipla ("assegna i selezionati al conto") **+** tendina conto per riga per le eccezioni.
- Assegnazione: dopo aver scelto gestione + conto, mostra anche i movimenti **senza gestione** (spesa "Generale", o proprietà non ancora assegnata) così si possono instradare.

## Architettura

### Feature 1 — Estratto conto per proprietà

**File modificati:** `src/pages/Cassa.tsx`. (Riusa `downloadEstrattoConto`/`EstrattoRow` da `EstrattoContoPDF.tsx` senza modifiche.)

- **`EstrattoDialog`**: aggiungere un toggle `level: 'gestione' | 'proprieta'`. Quando `proprieta`, mostrare un `Select` con tutte le proprietà reali + veicoli (label = nome). Lo stato target diventa `{ level, id, nome, isMobile? }`.
- **`inPeriod`**: già esiste e filtra per preset/intervallo con una `apertura`. Per la proprietà non c'è apertura → passare una sentinella `'1900-01-01'` così non taglia nulla all'inizio. (Nessuna modifica alla firma.)
- **Nuovo builder `buildEstrattoProprieta(target, conti, preset, from, to)`** → `{ rows, totEntrate, totUscite, saldoFinale }`:
  - Spese: `payments` dove `property_real_id = target.id` (o `property_mobile_id` se `isMobile`), `stato = 'pagato'`, dentro il periodo (`data_pagamento`). Riga: `{ data, descrizione, proprieta: target.nome, conto: contoNome(conto_id) ?? '—', entrata: 0, uscita: importo }`.
  - Incassi (solo immobili): `tenant_payments` con join `bookings.property_id = target.id`, `stato = 'pagato'`, dentro il periodo (`payment_date`). Riga: `{ data, descrizione: description||notes||'Incasso', proprieta: target.nome, conto: contoNome(conto_id) ?? '—', entrata: importo, uscita: 0 }`.
  - Unione, ordinamento per data asc. Saldo progressivo: parte da `0`, `saldo += entrata - uscita` riga per riga.
  - `totEntrate` = Σ entrata, `totUscite` = Σ uscita, `saldoFinale` = `totEntrate - totUscite`.
  - `contoNome`: mappa `conto_id → nome` costruita dai `conti` già caricati in pagina (`useCassa`/`useConti`).
- **Download**: `downloadEstrattoConto({ titolo: 'Estratto conto — ' + nome, periodo, rows, totEntrate, totUscite, saldoFinale }, 'estratto-' + slug(nome) + '.pdf')`.

Le date in colonna restano formattate `dd/MM/yyyy`; confronti periodo sui primi 10 char (ISO-safe), coerente con il fix già applicato a `inPeriod`.

### Feature 2 — Assegnazione movimenti senza conto

**File modificati:** `src/pages/Cassa.tsx`; **nuovo** `src/components/AssegnaContiDialog.tsx`. Nuovo hook conteggio (in `useCassa.ts` o nuovo `useMovimentiSenzaConto.ts`).

- **Conteggio / dati**: query dei movimenti **realizzati senza conto**:
  - spese: `payments` con `conto_id is null` e `stato = 'pagato'`, con `property_real_id`, `property_mobile_id`, `properties_real(nome, gestione_id)`, `properties_mobile(veicolo, gestione_id)`.
  - incassi: `tenant_payments` con `conto_id is null` e `stato = 'pagato'`, con `booking → properties_real(nome, gestione_id)`.
  - Normalizzati in una lista unica: `{ id, tipo: 'spesa'|'incasso', data, descrizione, proprieta, gestione_id, importo }`.
- **Banner** in cima a `Cassa.tsx`: se la lista non è vuota, card di avviso *"Hai N movimenti realizzati senza conto assegnato"* + bottone **"Assegna"** che apre il dialog. Se N = 0, nessun banner.
- **`AssegnaContiDialog`**:
  - Step 1: `Select` **gestione**; poi `Select` **conto di default** (conti di quella gestione).
  - Lista filtrata: movimenti la cui `gestione_id` = gestione scelta **OPPURE** `gestione_id` nullo (senza gestione). Ogni riga: checkbox · tipo · data · descrizione · proprietà · importo · `Select` conto per riga (default = conto scelto).
  - Azione massa: **"Assegna i selezionati al conto di default"** imposta la tendina di tutte le righe spuntate sul conto di default.
  - Salvataggio: mutation che fa `update conto_id` su `payments` / `tenant_payments` per ogni riga con conto impostato (batch per tabella). `onSuccess`: invalida `['cassa']`, `['conti']`, `['unified-expenses']`, `['revenues']` (e ciò che serve) + chiude il dialog.
- **Matching gestione**: spesa → `properties_real.gestione_id` / `properties_mobile.gestione_id`; incasso → `bookings.properties_real.gestione_id`. Movimenti senza proprietà/gestione → `gestione_id` nullo → instradabili manualmente.

## Nota di design (Hallmark)

I nuovi elementi UI (toggle nell'`EstrattoDialog`, banner di avviso, `AssegnaContiDialog`) sono **component-scope** (modal + banner), non una pagina nuova: in fase di implementazione si applica il **flusso "Component-scope" di Hallmark**, non il Design flow da landing page. Concretamente:

- **Pre-flight**: adottare token/font/componenti esistenti (shadcn/Tailwind, stile attuale di `Cassa.tsx`) — niente nuovo linguaggio visivo, niente nuovi token.
- **8 stati** su ogni elemento interattivo (default · hover · `:focus-visible` · active · disabled · loading · error · success), in particolare i bottoni "Assegna" e i `Select`.
- **Gate anti-slop applicabili**: nessuna chrome finta, copy onesto (niente numeri inventati nel banner — il conteggio N è reale), nessun heading in corsivo, responsive verificato a 320/375/414/768px, colori/font sempre via token nominati.
- **Si salta**: macrostruttura, hero, nav/footer, enrichment (roba page-scope).

Il contenuto di `SKILL.md` di Hallmark è già stato caricato in contesto in questa sessione, quindi la guida è applicabile anche senza invocazione "ufficiale" del tool `Skill`. Obiettivo: rifinitura coerente con l'app, **non** un restyle.

## Testing

- **`buildEstrattoProprieta`**: estrarre la parte pura (costruzione righe + saldo progressivo + totali da liste già fetchate) in una funzione testabile con vitest; verificare ordinamento, saldo cumulato, totali, gestione del conto mancante ("—"), e il filtro periodo.
- **Normalizzazione/matching movimenti senza conto**: funzione pura testata (mappa righe payments/tenant_payments → lista unica con `gestione_id` corretto, incluso il caso senza gestione).
- Resto verificato con `npm run build` + smoke manuale sul deploy.

## Fuori scope (YAGNI)

- Estratto per singolo conto (resta solo gestione + proprietà).
- Voci "previste" (da pagare/incassare) nell'estratto per proprietà → arriveranno con la funzione cashflow.
- Assegnazione di movimenti **non** realizzati (da pagare/incassare): il conto si sceglie alla conferma.
- Annullamento/disassegnazione in blocco (si può sempre modificare il singolo movimento).
