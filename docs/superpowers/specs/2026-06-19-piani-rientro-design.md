# Piani di Rientro — Design

Data: 2026-06-19
Stato: approvato per la stesura del piano di implementazione

## Problema

Oggi i debiti rateizzati (Agenzia delle Entrate, amministratore di condominio,
fornitori con piani di rientro) vanno inseriti **una scadenza alla volta** come
singole spese. È lento e soggetto a errori. Serve poter creare un **piano di
rientro** che generi automaticamente tutte le rate. Ispirato all'"Archivio
Rientri" di EdilCRM.

## Decisioni prese (brainstorming)

1. **Rate = Spese collegate.** Ogni rata generata è una riga `payments` normale:
   compare in Spese, Cassa, scadenze, statistiche, e si paga con i bottoni
   esistenti. Crei il piano una volta → genera N scadenze.
2. **Posizione:** nuova tab "Rientri" dentro la pagina Spese (accanto a
   Scadute / In Scadenza / Anticipi / Storico).
3. **Doppia origine:** consolidamento di spese esistenti **e** piano custom da
   zero.
4. **Direzione:** sia debiti/uscite sia crediti/entrate. Gestiti entrambi nel
   table `payments` via `is_advance` (false = uscita "Paga"; true = credito
   "Rimborsato" con `debtor_name`). Non si tocca il table `income`.
5. **Modifica importo totale dopo pagamenti:** rigenera **solo le rate non
   pagate**, ridistribuendo il residuo; le rate già pagate restano intoccate.

## Modello dati

### Nuova tabella `piani_rientro`

| campo | tipo | note |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `user_id` | uuid | RLS owner |
| `gestione_id` | uuid FK → gestioni | obbligatorio (coerente con conti/payments) |
| `fornitore` | text | creditore (uscita) o debitore (entrata) |
| `direzione` | text CHECK in ('uscita','entrata') | default 'uscita' |
| `importo_totale` | numeric | modificabile (dilazioni/interessi/sconti) |
| `numero_rate` | int CHECK 2..60 | |
| `frequenza` | text | mensile/bimestrale/trimestrale/semestrale/annuale/personalizzata |
| `data_prima_rata` | date | |
| `stato` | text CHECK in ('attivo','completato','annullato') | default 'attivo' |
| `note` | text null | |
| `created_at`, `updated_at` | timestamptz | default now() |

RLS: stesse policy owner-based delle altre tabelle finanziarie (select/insert/
update/delete su `user_id = auth.uid()`).

### Colonne nuove su `payments`

- `piano_rientro_id` uuid null, FK → piani_rientro ON DELETE SET NULL.
  Identifica le **rate generate** dal piano.
- `rata_numero` int null. Numero progressivo della rata (1..N).
- `consolidato_in_piano_id` uuid null, FK → piani_rientro ON DELETE SET NULL.
  Marca le **spese originali assorbite** da un piano (consolidamento).

Una rata è una `payments` con:
- `descrizione` = `"Rata {k}/{N} — {fornitore}"`
- `importo` = importo rata
- `scadenza` = data rata
- `is_advance` = (direzione === 'entrata')
- `debtor_name` = fornitore se entrata, altrimenti null
- `fornitore`, `gestione_id` ereditati dal piano
- `categoria` = 'altro' (default), `stato` = 'in_attesa'
- `piano_rientro_id`, `rata_numero` valorizzati

Le spese consolidate (`consolidato_in_piano_id IS NOT NULL`) restano per storico
ma vengono **escluse dagli scadenzari attivi** (Scadute/In Scadenza/Anticipi) e
mostrate raggruppate sotto la card del piano ("N fatture originali consolidate").

## Generazione rate

Intervallo per frequenza, a partire da `data_prima_rata`:
mensile +1, bimestrale +2, trimestrale +3, semestrale +6, annuale +12 mesi.
(`personalizzata` → le date arrivano dalla tabella editabile.)

- **Importi uguali:** `importo_totale / numero_rate`, arrotondato a 2 decimali;
  l'**ultima rata assorbe** la differenza di arrotondamento così la somma torna
  esatta al centesimo.
- **Importi personalizzati** (checkbox attivo): si usano le righe della tabella
  così come sono (data + importo per rata).
  - Bottone **"Distribuisci"**: spalma `importo_totale` equamente sulle righe.
  - Indicatore live: *Somma rate: X / atteso Y* (avvisa se non combaciano).

## UI

### Tab "Rientri" (dentro Spese)

- **Mini-header KPI:** Piani attivi · In ritardo · Residuo totale.
- **Card per piano** (stile EdilCRM):
  - fornitore + badge stato (Attivo/Completato/Annullato)
  - `{pagate}/{totali} rate — € {pagato} pagati` + barra avanzamento %
  - Totale · Residuo
  - frequenza + range date (Dal … al …)
  - **prossima rata:** data, importo, "tra N gg" (prima rata non pagata)
  - espandibile: elenco rate + "N fatture originali consolidate"
  - azioni: espandi · modifica · elimina

### Dialog "Nuovo Piano di Rientro" (rif. screenshot utente)

Campi:
- Fornitore* (select fornitori esistenti; con possibilità testo libero)
- Importo totale del piano (€)* — precompilato con somma scadenze selezionate
  (in consolidamento), modificabile
- Numero rate* (2–60) · Frequenza*
- Data prima rata*
- Checkbox **"Importi personalizzati per rata"** → tabella (# · Data scadenza ·
  Importo) + "Distribuisci" + indicatore Somma/atteso
- Note
- Footer: Annulla · **Crea piano e genera rate**

In **modifica**: stesso dialog; cambiando `importo_totale` o le rate si
rigenerano **solo le rate non pagate** (le pagate restano), ridistribuendo il
residuo sulle future.

### Due punti d'ingresso, stesso dialog

1. **"+ Nuovo piano di rientro"** (dalla tab Rientri): dialog vuoto.
2. **Consolidamento:** modalità selezione (checkbox) nelle liste spese →
   azione "Consolida in piano di rientro" → apre il dialog con `importo_totale`
   = somma selezionate e `fornitore` precompilato se uniforme. Alla conferma le
   spese selezionate ricevono `consolidato_in_piano_id`.

## Codice

- **Migration** `supabase/migrations/<ts>_piani_rientro.sql`: tabella + colonne
  su payments + RLS + indici (`piano_rientro_id`, `consolidato_in_piano_id`).
- **Types**: rigenerare `src/integrations/supabase/types.ts`.
- **Hook** `src/hooks/usePianiRientro.ts`:
  - query: lista piani + rate aggregate (residuo, % pagato, prossima rata,
    in ritardo) calcolate client-side dalle `payments` collegate
  - `createPiano`: inserisce piano + genera/inserisce rate; in consolidamento
    setta `consolidato_in_piano_id` sulle originali — operazioni in sequenza,
    con rollback logico se una fallisce
  - `updatePiano`: rigenera solo rate non pagate
  - `deletePiano`: opzione elimina rate non pagate / scollega; scollega originali
- **Componenti**:
  - `src/components/PianoRientroDialog.tsx` — il dialog di creazione/modifica
  - sezione `Rientri` dentro `src/pages/Expenses.tsx` (tab + card piani),
    oppure estratta in `src/components/RientriTab.tsx` se Expenses cresce troppo
- Pagamento singola rata: riusa le mutation esistenti di Expenses (Paga /
  Rimborsato) — al pagamento il piano ricalcola progress/stato (→ `completato`
  quando tutte le rate sono pagate).

## Fuori scope (v1)

- Interessi/penali automatici (l'importo totale è inserito manualmente).
- Promemoria/notifiche dedicate alle rate (sfruttano lo scadenzario esistente).
- Generazione PDF del piano.
