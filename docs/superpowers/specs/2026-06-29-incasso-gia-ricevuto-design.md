# Incasso "già ricevuto" inline — design

**Data:** 2026-06-29
**Stato:** approvato (in attesa di review utente sullo spec)

## Problema

Il form "Nuovo Incasso / Piano Rateale" (`src/components/Revenue.tsx`) inserisce
ogni incasso con `stato: 'da_pagare'`: è sempre una voce *futura/da incassare*.
Per registrare denaro **già ricevuto** servono due passaggi:

1. Creo l'incasso (→ `da_pagare`)
2. Clicco **Incassa** → dialog "Conferma Incasso" (data, metodo, conto) → `pagato`

Va bene per il canone schedulato ("registra ora, incassa dopo"), ma è scomodo
per un **incasso occasionale una-tantum già ricevuto** (es. acconto, extra).

Per confronto, il form **Spese** (`src/pages/Expenses.tsx`) ha un campo **Stato**
(Da Pagare / Pagato) più metodo e conto inline: una spesa già pagata si registra
in **un solo passaggio**. L'asimmetria è il problema da risolvere.

## Obiettivo / scope

Aggiungere **un solo flusso**: registrare un incasso occasionale **già ricevuto**
come `pagato` in un passaggio, con data/metodo/conto inline, coerente con il form
Spese.

**Fuori scope:**
- Rate ricorrenti già incassate (il rateale resta "da incassare").
- Incassi senza inquilino/booking (il modello resta legato a `booking_id`).
- Modifiche al flusso schedulato esistente o al dialog "Conferma Incasso".

## Soluzione

### 1. UI — `src/components/Revenue.tsx`, dialog "Nuovo Incasso"

In cima alla sezione **3. Dettagli**, un segmented control **Stato** con due voci:

- **Da incassare** (default): form attuale invariato — *Prima scadenza* + blocco
  *Piano rateale mensile*. Comportamento identico a oggi.
- **Già incassato**:
  - la label della data diventa **"Data ricevuto"** (default: oggi);
  - compare un blocco con **Metodo** (gli stessi `METHOD_OPTIONS` del Conferma
    Incasso, default `bonifico`) e **Conto** (lista `conti`, **opzionale** come
    nel Conferma Incasso attuale);
  - il blocco **Piano rateale viene nascosto** (mutuamente esclusivo con
    "già incassato").

Il pulsante di submit recita **"Registra incasso"** in modalità "già incassato"
(invece di "Registra" / "Genera N rate").

### 2. Stato del form

Estendere lo state `form` con:

- `already_paid: boolean` (default `false`)
- `payment_method: string` (default `'bonifico'`)
- `conto_id: string` (default `''`)

Quando `already_paid === true`, forzare `is_recurring = false`.
Sul reset del form, riportare i nuovi campi ai default.

### 3. Scrittura — `src/hooks/useRevenue.ts` → `createPaymentPlan`

Estendere i params della mutation con i campi opzionali di pagamento
(`already_paid`, `payment_method`, `conto_id`).

Nel ramo **singolo** (non ricorrente), se `already_paid`:

```
stato: 'pagato',
data_scadenza: <data ricevuto>,
payment_date: new Date(<data ricevuto>).toISOString(),
payment_type: <payment_method>,
conto_id: <conto_id || null>,
```

Altrimenti, comportamento attuale (`stato: 'da_pagare'`, nessun campo pagamento).
Il ramo ricorrente resta invariato. Si riusano esattamente i campi che
`confirmPayment` già scrive, così l'incasso entra nel bucket "pagato" e nel KPI
"Incassato" senza ulteriori modifiche a query, bucket o KPI.

### 4. Validazione

- **Da incassare**: come oggi (Importo + Prima scadenza).
- **Già incassato**: richiede **Importo + Data ricevuto + Metodo**; Conto
  opzionale.

## Note di implementazione

- `METHOD_OPTIONS` e la lista `conti` sono già disponibili in `Revenue.tsx`
  (usati dal dialog "Conferma Incasso") — nessuna nuova fonte dati.
- Nessuna migrazione DB: i campi `payment_date`, `payment_type`, `conto_id`
  esistono già su `tenant_payments`.
- Toast di successo: quando `already_paid` mostrare "Incasso registrato" /
  "Registrato in cassa"; negli altri casi resta il messaggio attuale
  ("Piano Registrato" / "scadenze generate").
