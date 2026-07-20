# Report entrate/uscite per proprietà — design

Data: 2026-07-20 · Stato: approvato

## Obiettivo
Un PDF riepilogativo con una riga per proprietà (entrate, uscite, netto del periodo),
per confrontare tutte le proprietà in un colpo d'occhio — oggi esistono solo
l'estratto per gestione e quello per singola proprietà.

## Accesso
Cassa → dialog "Estratto conto": il selettore passa da 2 a 3 voci —
*Per gestione* / *Per proprietà* / *Report proprietà*. Con "Report proprietà"
non si seleziona nulla (entrano tutte le proprietà, case e veicoli).
Filtri periodo invariati: Tutto / Anno / Mese / Personalizzato.

## Dati
- Entrate: `tenant_payments` con `stato='pagato'`, proprietà via `bookings → properties_real`.
  Data efficace: `payment_date` con fallback `data_scadenza` (`dataIncasso`), come nel resto della cassa.
- Uscite: `payments` con `stato='pagato'`, proprietà via `property_real_id`/`property_mobile_id`.
  Data: `data_pagamento`.
- Il conto di transito è irrilevante (report per proprietà, non per cassa).
- Compaiono solo le proprietà con almeno un movimento nel periodo.
- Movimenti pagati senza proprietà associata finiscono in una riga "(senza proprietà)":
  mai troncare importi in silenzio.

## PDF
Una pagina A4 verticale: tabella Proprietà / Entrate / Uscite / Netto,
ordinata per netto decrescente, netto in rosso se negativo, riga TOTALE in fondo.
Stesso stile react-pdf degli estratti esistenti.

## Struttura codice
- `src/utils/reportProprieta.ts` — helper puro `aggregaReportProprieta(movs)` + test vitest.
- `src/components/ReportProprietaPDF.tsx` — documento react-pdf + download.
- `src/pages/Cassa.tsx` — livello `report` nel dialog, builder `buildReportProprieta`
  (fetch + filtro periodo) accanto ai due esistenti.
