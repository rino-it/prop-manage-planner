# Collaboratori + UX incassi/spese — design

Data: 2026-07-24 · Stato: approvato dall'utente (sessione 2026-07-24)

## Contesto
Richieste utente: (a) modificare un incasso cliccandoci sopra; (b) ordinamento per data
in tutte le liste di Incassi e Spese; (c) modulo Collaboratori (keyholder/pulizie) con
compensi auto-generati dalle prenotazioni. Il presunto bug "Daniela Disanza assente
dall'estratto bper" è stato verificato e NON è un bug (il pagamento 277,33 € esiste,
pagato, 22/07, conto assegnato — l'utente ha confermato "bastano i 277").

## 1. Click-to-edit incasso
La riga di un incasso (zona sinistra + importo) apre il dialog Modifica esistente.
Vale in tutte le tab, compreso Incassati (dove oggi manca anche la matita).
I bottoni interni (Incassa, calendario, cestino, select conto) NON devono propagare il click.

## 2. Ordinamento per data
Regola unica per Incassi e Spese:
- Liste aperte (Scaduti, In scadenza, Oltre 30gg): scadenza crescente (più vicina in alto).
- Storici (Incassati / Storico pagate) e gruppi mese: data pagamento decrescente.
L'ordinamento vive nei helper puri (`bucketByScadenza`, `groupByMonth`) con test.

## 3. Collaboratori
- Anagrafica: `collaboratori` (nome, telefono, note, attivo).
- Condizioni per proprietà: `collaboratori_condizioni` (collaboratore, property, tipo
  `checkin` | `pulizia` | `mensile`, importo, attivo). Il mensile ha property NULL (compenso generale).
- Generazione automatica: TRIGGER Postgres su INSERT in `bookings` → crea righe in
  `payments` ("Compenso <nome> — check-in/pulizia <ospite>", stato `da_pagare`,
  scadenza = data_inizio per checkin, data_fine per pulizia, `collaboratore_id`,
  `source_booking_id`). Su DELETE del booking: elimina i compensi ancora `da_pagare`.
  Il trigger copre ogni canale (UI, sync-ical, sync-portals) senza toccare le edge functions.
- Mensile: generato lazy all'apertura della pagina Collaboratori (se manca la voce del
  mese corrente per una condizione mensile attiva, si crea con scadenza 1° del mese,
  descrizione deterministica "Compenso <nome> — mensile <yyyy-MM>" per l'idempotenza).
- Scheda: pagina `Collaboratori` (menu GESTIONE): elenco, condizioni, e per ognuno
  maturato / pagato / da pagare + storico voci (payments con collaboratore_id).
- In Spese: le spese-compenso sono payments normali; badge col nome del collaboratore.
- Resilienza: come per property_id, probe `hasCollaboratori()` in `src/lib/dbFeatures.ts`;
  senza migrazione la pagina mostra l'avviso "esegui la migrazione" e il resto dell'app
  non si rompe.

## Vincoli
- Push su main a fine lavoro (l'utente rivede sul deploy live).
- Migrazioni SOLO come file SQL additivi; l'esecuzione la fa l'utente nel SQL Editor
  (la chiave anonima non può eseguire DDL). Ancora pendente anche la migrazione
  property_id del 2026-07-20.
- Design system esistente (design.md, Iris/Indaco, shadcn) — nessun nuovo stile globale.
