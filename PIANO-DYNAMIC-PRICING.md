# Piano Implementazione Dynamic Pricing - PropManage

**Data:** 2026-03-27
**Stato attuale:** Il sistema pricing calcola prezzi in modo deterministico (base + stagione + weekend). Il campo `strategy: 'dynamic'` esiste ma non ha logica. Le fasce Bassa/Media/Alta nel calendario sono cosmetiche.

---

## OPZIONE A - Pricing Rule-Based (Occupancy-Driven)

Obiettivo: far variare i prezzi automaticamente in base all'occupancy reale, usando solo dati gia presenti in Supabase. Zero dipendenze esterne, zero costi API aggiuntivi.

### A1. Nuova tabella `occupancy_cache`

**Cosa:** Tabella materializzata che pre-calcola l'occupancy per property/mese, aggiornata da trigger.

```sql
CREATE TABLE occupancy_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties_real(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  occupancy_rate NUMERIC(5,2),        -- 0.00 - 100.00
  booked_nights_in_month INTEGER,
  total_nights_in_month INTEGER,
  days_until_date INTEGER,            -- per last-minute logic
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, target_date)
);
```

**Perche:** Evita di ricalcolare l'occupancy ad ogni render del calendario. La query su `bookings` con range overlap e costosa se fatta per 30+ giorni * N proprieta.

**Come si aggiorna:**
- Trigger `AFTER INSERT/UPDATE/DELETE` su `bookings` ricalcola le righe del mese interessato.
- Alternativa piu semplice: una Supabase Edge Function su cron (ogni 6 ore) che ricalcola tutto il mese corrente + successivo.

### A2. Estensione `pricing_rules` con regole di occupancy

**Cosa:** Aggiungere una colonna `occupancy_rules` (JSONB) alla tabella esistente.

```sql
ALTER TABLE pricing_rules
ADD COLUMN occupancy_rules JSONB DEFAULT '[]'::jsonb;
```

Struttura:
```typescript
interface OccupancyRule {
  name: string;                         // "Alta domanda", "Last minute"
  type: 'occupancy' | 'last_minute' | 'gap_filler';
  condition: {
    metric: 'monthly_occupancy' | 'days_until_checkin';
    operator: 'gt' | 'lt' | 'gte' | 'lte';
    value: number;                      // percentuale o giorni
  };
  adjustment_percent: number;           // +15, -10, etc.
  priority: number;                     // ordine di applicazione
}
```

Regole di default suggerite:
| Regola | Condizione | Aggiustamento |
|--------|-----------|---------------|
| Alta domanda | occupancy mese > 80% | +15% |
| Domanda forte | occupancy mese > 60% | +8% |
| Bassa domanda | occupancy mese < 30% | -10% |
| Last minute | giorni alla data < 3 e notte libera | -12% |
| Gap filler | notte libera tra due prenotazioni (1-2 notti) | -15% |

### A3. Evoluzione di `calculateNightPrice`

**Cosa:** Estendere la funzione per interrogare `occupancy_cache` e applicare le `occupancy_rules`.

**Dove:** `src/hooks/usePricing.ts`

L'ordine di applicazione diventa:
1. Base price
2. Season adjustments (come oggi)
3. Weekend adjustment (come oggi)
4. **Occupancy rules** (NUOVO - applicate in ordine di priority)
5. Clamp min/max

La funzione deve diventare asincrona oppure ricevere i dati di occupancy come parametro (preferisco la seconda: mantiene la funzione pura e testabile).

```typescript
export function calculateNightPrice(
  rule: PricingRule,
  date: Date,
  occupancyData?: { rate: number; daysUntil: number; isGap: boolean }
): number {
  let price = rule.base_price;
  // ... season + weekend come prima ...

  if (rule.strategy === 'dynamic' && occupancyData && rule.occupancy_rules) {
    for (const oRule of sortByPriority(rule.occupancy_rules)) {
      if (evaluateCondition(oRule.condition, occupancyData)) {
        price = price * (1 + oRule.adjustment_percent / 100);
        break; // applica solo la prima regola che matcha
      }
    }
  }

  // clamp min/max
  return Math.round(price * 100) / 100;
}
```

### A4. Hook `useOccupancyData`

**Cosa:** Nuovo hook React che fetcha i dati di occupancy per una property e un range di date.

```typescript
export const useOccupancyData = (propertyId: string, month: number, year: number) => {
  return useQuery({
    queryKey: ['occupancy', propertyId, month, year],
    queryFn: async () => {
      // Query occupancy_cache per il mese
      // + calcolo gap detection (notti libere tra due booking)
      // + calcolo days_until per ogni data
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
};
```

### A5. Aggiornamento UI - Calendario Prezzi

**Cosa:** Il `PriceCalendarPreview` mostra ora prezzi realmente diversi. Le fasce di colore hanno finalmente senso.

Aggiunte:
- Tooltip su hover che spiega il prezzo: "270 base + 15% alta domanda = 310.50"
- Indicatore visivo per notti con regola applicata (piccolo badge o bordo)
- Nella card della property, mostrare "Occupancy mese: 72%" accanto al prezzo di stasera

### A6. Aggiornamento UI - Dialog regole

**Cosa:** Aggiungere una sezione "Regole di Occupancy" nel `PricingRuleDialog`, visibile solo quando `strategy === 'dynamic'`.

- Template pre-compilato con le 5 regole di default
- Possibilita di aggiungere/rimuovere/editare regole
- Preview in tempo reale: "Con queste regole, il prezzo di stasera sarebbe X"

### A7. Migration e seed

**Cosa:** Migration Supabase per creare `occupancy_cache`, aggiungere `occupancy_rules` a `pricing_rules`, e creare la funzione SQL di ricalcolo occupancy.

### Effort stimato Opzione A

| Step | Effort | Dipendenze |
|------|--------|------------|
| A1 - occupancy_cache | 2h | Nessuna |
| A2 - occupancy_rules colonna | 30min | A1 |
| A3 - calculateNightPrice | 2h | A1, A2 |
| A4 - useOccupancyData | 1.5h | A1 |
| A5 - UI calendario | 2h | A3, A4 |
| A6 - UI dialog regole | 2h | A2 |
| A7 - migration + seed | 1h | A1, A2 |
| **Totale** | **~11h** | |

---

## OPZIONE B - Pricing AI-Assisted (Claude-Powered)

Obiettivo: un agente che analizza i dati storici e correnti, e suggerisce prezzi ottimali che il proprietario approva o rifiuta. Si appoggia sull'infrastruttura dell'Opzione A.

**Prerequisito: l'Opzione A deve essere completata.** L'AI ha bisogno dei dati di occupancy strutturati per fare analisi sensate.

### B1. Nuova tabella `price_suggestions`

```sql
CREATE TABLE price_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties_real(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  current_price NUMERIC(10,2),
  suggested_price NUMERIC(10,2),
  confidence NUMERIC(3,2),              -- 0.00 - 1.00
  reasoning TEXT,                       -- spiegazione leggibile
  factors JSONB,                        -- { occupancy: 0.75, season: "alta", ... }
  status TEXT DEFAULT 'pending',        -- pending | accepted | rejected | expired
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  user_id UUID,
  UNIQUE(property_id, target_date, status)
);
```

### B2. Edge Function `ai-pricing-suggest`

**Cosa:** Edge Function che riceve property_id + date range, raccoglie contesto, chiama Claude, e salva suggerimenti.

**Pattern:** Segue esattamente `ai-triage-ticket` gia esistente.

**Dati inviati a Claude:**
- Occupancy corrente e storica (da `occupancy_cache`)
- Booking velocity (quante prenotazioni negli ultimi 7/14/30 giorni)
- Stagione corrente e regole attive
- Prezzi attuali vs min/max
- Storico prezzi accettati/rifiutati (feedback loop)
- Numero di gap nights nel mese

**Prompt a Claude:**
```
Sei un revenue manager per affitti brevi in Italia.
Analizza questi dati per [property_name] e suggerisci prezzi per le prossime 30 notti.

[dati strutturati]

Rispondi in JSON con questo formato per ogni data:
{
  "date": "2026-04-01",
  "suggested_price": 295,
  "confidence": 0.85,
  "reasoning": "Occupancy aprile al 72%, 3 notti gap tra il 5 e il 7 aprile...",
  "factors": { "occupancy": 0.72, "gap": true, "days_until": 5 }
}

Vincoli:
- min_price: X, max_price: Y
- Non suggerire variazioni > 30% rispetto al prezzo base
- Se i dati sono insufficienti, abbassa la confidence
```

**Modello:** `claude-haiku-4-5-20251001` (veloce, economico, gia in uso nel progetto).

**Costo stimato:** ~0.01-0.03 USD per run (30 notti = ~2000 token input, ~3000 output).

### B3. Scheduling - Cron giornaliero

**Cosa:** La Edge Function gira ogni mattina alle 06:00 via Supabase pg_cron o via un cron esterno.

Flusso:
1. Seleziona tutte le `pricing_rules` con `strategy = 'dynamic'`
2. Per ogni property, chiama `ai-pricing-suggest`
3. Salva i suggerimenti in `price_suggestions` con status `pending`
4. Invalida i suggerimenti vecchi (> 48h non reviewati -> `expired`)

### B4. UI - Pannello suggerimenti

**Cosa:** Nuovo tab nella pagina Prezzi: "Suggerimenti AI"

Mostra:
- Lista dei suggerimenti pending, raggruppati per property
- Per ogni suggerimento: data, prezzo attuale, prezzo suggerito, delta %, confidence (barra), reasoning
- Azioni: Accetta (applica il prezzo), Rifiuta (con motivo opzionale), Accetta tutti
- Storico dei suggerimenti accettati/rifiutati

Quando un suggerimento viene accettato:
- Crea/aggiorna una riga in una nuova tabella `price_overrides` (o aggiunge il prezzo come `adjustment_fixed` nella stagione)
- Il `calculateNightPrice` controlla prima se esiste un override per quella data

### B5. Tabella `price_overrides`

```sql
CREATE TABLE price_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties_real(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  override_price NUMERIC(10,2) NOT NULL,
  source TEXT DEFAULT 'ai_suggestion',  -- ai_suggestion | manual
  suggestion_id UUID REFERENCES price_suggestions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID,
  UNIQUE(property_id, target_date)
);
```

`calculateNightPrice` controlla prima qui: se esiste un override per la data, usa quello. Altrimenti calcola normalmente.

### B6. Feedback loop

**Cosa:** I suggerimenti rifiutati vengono usati come contesto negativo nelle chiamate successive a Claude.

"In passato hai suggerito 320 per il 15 aprile e il proprietario ha rifiutato, dicendo 'troppo alto per bassa stagione'. Tieni conto di questo feedback."

Questo migliora la qualita dei suggerimenti nel tempo senza fine-tuning.

### B7. Notifica digest

**Cosa:** Integrare i suggerimenti nel digest giornaliero (`ai-digest` gia esistente).

Aggiunta al digest: "Hai 8 suggerimenti di prezzo in attesa di revisione. I piu significativi: Villa Sardegna 12 aprile da 225 a 280 (+24%, confidence 92%)."

### B8. Metriche di performance

**Cosa:** Tracciare se i suggerimenti accettati portano effettivamente a piu prenotazioni o revenue.

Nuova vista in Statistiche:
- Tasso di accettazione suggerimenti (%)
- Revenue delta tra prezzi suggeriti accettati vs base
- Occupancy pre/post attivazione pricing dinamico

### Effort stimato Opzione B

| Step | Effort | Dipendenze |
|------|--------|------------|
| B1 - price_suggestions table | 1h | Opzione A completata |
| B2 - Edge Function AI | 4h | B1 |
| B3 - Cron scheduling | 1.5h | B2 |
| B4 - UI suggerimenti | 4h | B1, B2 |
| B5 - price_overrides | 1.5h | B4 |
| B6 - Feedback loop | 2h | B2, B4 |
| B7 - Integrazione digest | 1h | B2, ai-digest esistente |
| B8 - Metriche | 3h | B5, useStatistics |
| **Totale** | **~18h** | |

---

## Ordine di esecuzione raccomandato

```
Settimana 1: A1 -> A2 -> A7 -> A3 -> A4
             (infrastruttura dati + logica calcolo)

Settimana 2: A5 -> A6
             (UI aggiornata, pricing rule-based operativo)

Settimana 3: B1 -> B2 -> B3 -> B5
             (backend AI, suggerimenti generati)

Settimana 4: B4 -> B6 -> B7 -> B8
             (UI suggerimenti, feedback loop, metriche)
```

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Dati storici insufficienti (poche prenotazioni) | Claude suggerisce prezzi poco affidabili | Mostrare confidence bassa, suggerire solo per property con > 10 booking storici |
| Occupancy cache non aggiornata | Prezzi calcolati su dati stale | Trigger su bookings + cron ogni 6h come fallback |
| Proprietario ignora i suggerimenti | Feature inutilizzata | Notifiche push nel digest + badge "X suggerimenti in attesa" nella sidebar |
| Costi API Claude crescono | Budget imprevedibile | Haiku e economico (~0.03/run), con 5 property = ~4.50 USD/mese. Cap mensile configurabile |
| Suggerimenti troppo aggressivi | Prezzi fuori mercato | min/max come guardrail assoluti + limite variazione max 30% |

## Decisioni architetturali

1. **Occupancy cache come tabella separata** invece che calcolo al volo: performance. Il calendario renderizza 30+ celle per property.

2. **Override per data specifica** invece che modificare il base_price: mantiene la regola originale intatta. Se cancelli un override torni al prezzo calcolato. Reversibilita totale.

3. **Claude Haiku invece di Sonnet/Opus**: il task e strutturato (dati in, JSON out). Haiku e sufficiente, 10x piu economico di Opus, e gia usato nel progetto.

4. **Feedback come contesto nel prompt** invece che fine-tuning: zero costi aggiuntivi, nessuna infrastruttura ML, risultati immediati.

5. **Opzione A come prerequisito di B**: l'AI senza dati strutturati di occupancy produce suggerimenti casuali. La rule-based crea il substrato dati su cui l'AI ragiona.
