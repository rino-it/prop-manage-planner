# STEP 2: WhatsApp Bot + AI Ticket & API Marketplace

Data: 2026-03-23
Stato: Implementazione completata - Pronto per deploy e integrazione

---

## A. WhatsApp Bot con AI per Ticket

### File creati

| File | Scopo |
|------|-------|
| `supabase/migrations/20260323_whatsapp_ticket_integration.sql` | Schema DB: campi WhatsApp/AI su tickets, tabelle whatsapp_messages, whatsapp_config |
| `supabase/functions/whatsapp-webhook/index.ts` | Edge Function: riceve webhook Meta, valida firma, logga messaggio, chiama process-ticket |
| `supabase/functions/whatsapp-process-ticket/index.ts` | Edge Function: identifica inquilino, analisi AI con Claude Haiku, crea ticket, notifica proprietario |

### Flusso implementato

1. Inquilino scrive su WhatsApp al numero bot
2. Meta Cloud API chiama `whatsapp-webhook` (GET per verifica, POST per messaggi)
3. Il webhook valida la firma `x-hub-signature-256`, logga in `whatsapp_messages`, e chiama `whatsapp-process-ticket` in modo asincrono (risposta HTTP 200 entro 5s)
4. `whatsapp-process-ticket`:
   - Normalizza il numero di telefono (varianti +39, 39, senza prefisso)
   - Cerca booking attivo per `telefono_ospite` o `whatsapp_phone`
   - Se non trova booking attivo, cerca l'ultimo booking per quel numero
   - Recupera storico ticket (ultimi 5)
   - Chiama Claude Haiku con prompt strutturato che include contesto completo e stagione
   - Claude ritorna: priorita, categoria (da lista predefinita), suggerimento operativo, confidence
   - Crea ticket in `tickets` con source='whatsapp' e tutti i campi AI
   - Invia notifica al proprietario via WhatsApp (messaggio strutturato con contesto + analisi)
   - Invia conferma ricezione all'inquilino

### Schema DB aggiunto

- `tickets`: 10 nuove colonne (source, whatsapp_message_id, whatsapp_from, ai_categoria, ai_priorita, ai_suggerimento, ai_confidence, property_real_id, property_mobile_id, assigned_partner_id, scadenza, allegati)
- `whatsapp_messages`: log completo messaggi inbound/outbound con FK a tickets e bookings
- `whatsapp_config`: configurazione multi-proprietario (phone_number_id, waba_id, access_token, owner_whatsapp)
- `bookings.whatsapp_phone`: campo dedicato per lookup WhatsApp

### Fallback analysis

Se Claude API non e disponibile o fallisce, il sistema usa un'analisi keyword-based che mappa parole chiave a categorie e priorita. Questo garantisce che i ticket vengano sempre creati anche senza AI.

### Variabili d'ambiente richieste

```
WHATSAPP_VERIFY_TOKEN=<token scelto da te per verifica webhook>
WHATSAPP_APP_SECRET=<App Secret da Meta Developer Console>
WHATSAPP_ACCESS_TOKEN=<Token WhatsApp Business API>
ANTHROPIC_API_KEY=<API key Anthropic per Claude Haiku>
```

### Setup Meta (da fare manualmente)

1. Creare account su developers.facebook.com
2. Aggiungere prodotto "WhatsApp"
3. Creare WhatsApp Business Account (WABA)
4. Verificare numero telefono dedicato al bot
5. Configurare webhook URL: `https://<supabase-project>.supabase.co/functions/v1/whatsapp-webhook`
6. Inserire il VERIFY_TOKEN scelto
7. Sottoscrivere al campo "messages"

---

## B. API Marketplace - Integrazioni

### 1. Validazione Codice Fiscale (implementata)

| File | Scopo |
|------|-------|
| `src/utils/codiceFiscale.ts` | Validazione completa CF: formato, check digit, parsing genere/data/luogo |
| `src/components/CodiceFiscaleInput.tsx` | Componente React con validazione real-time, feedback visivo, parsing risultati |

- Validazione pura lato client, nessuna API esterna
- Verifica: formato 16 caratteri, codice mese, giorno valido, check digit algoritmico
- Parsing: estrae genere (M/F), giorno/mese/anno nascita, codice comune
- Pronto per integrazione in TenantPortal.tsx e GuestPortal.tsx

### 2. Geocoding con LocationIQ (implementato)

| File | Scopo |
|------|-------|
| `src/utils/geocoding.ts` | Client LocationIQ: geocode, autocomplete, debounce |
| `src/components/AddressAutocomplete.tsx` | Componente Input con autocomplete e selezione indirizzo |

- Free tier: 5.000 richieste/giorno
- Autocomplete con debounce 400ms, filtro Italia
- Restituisce coordinate GPS (lat/lon) per mappa
- Graceful degradation: se VITE_LOCATIONIQ_API_KEY non configurata, si comporta come input normale
- Pronto per sostituzione in AddPropertyDialog.tsx (campo indirizzo)

**Variabile d'ambiente:** `VITE_LOCATIONIQ_API_KEY=<key da locationiq.com>`

### 3. Meteo con Open-Meteo (implementato)

| File | Scopo |
|------|-------|
| `src/utils/weather.ts` | Client Open-Meteo: previsioni 7gg, codici WMO, severita meteo |
| `src/components/WeatherWidget.tsx` | Widget React: vista compatta e completa, cache 30min |

- Completamente gratuito, no API key, open-source
- Previsioni fino a 16 giorni
- Codici WMO tradotti in italiano con icone
- Funzione `getWeatherSeverity()` per prioritizzazione ticket (es. infiltrazioni + pioggia = urgente)
- Due modalita: `compact` (inline) e full (card con 7 giorni)
- Pronto per integrazione in Dashboard e pagina Tickets

### 4. DeepL Translation (gia implementato)

`src/i18n/useTranslate.ts` gia contiene l'integrazione DeepL con fallback MyMemory. Nessun intervento necessario.

**Variabile d'ambiente:** `VITE_DEEPL_API_KEY=<key da deepl.com/pro-api>`

---

## Riepilogo costi stimati mensili

| Servizio | Free Tier | Costo stimato 20 ticket/mese |
|----------|-----------|------------------------------|
| WhatsApp Cloud API (inbound) | Illimitato | Gratis |
| WhatsApp Cloud API (outbound template) | - | ~0.60 EUR |
| Claude Haiku API | - | ~0.20 EUR |
| LocationIQ | 5.000/giorno | Gratis |
| Open-Meteo | Illimitato | Gratis |
| DeepL | 500.000 char/mese | Gratis |
| **Totale** | | **~0.80 EUR/mese** |

---

## Prossimi passi per completare l'integrazione

1. **Applicare la migration** su Supabase: eseguire `20260323_whatsapp_ticket_integration.sql`
2. **Deploy Edge Functions**: `supabase functions deploy whatsapp-webhook` e `whatsapp-process-ticket`
3. **Configurare secrets** Supabase: `supabase secrets set WHATSAPP_VERIFY_TOKEN=... ANTHROPIC_API_KEY=...`
4. **Setup Meta Developer Console**: creare WABA, verificare numero, configurare webhook
5. **Inserire config in DB**: popolare `whatsapp_config` con dati Meta
6. **Integrare componenti nel frontend**:
   - `CodiceFiscaleInput` in TenantPortal.tsx (Step 1 - Contatti)
   - `AddressAutocomplete` in AddPropertyDialog.tsx (campo indirizzo)
   - `WeatherWidget` in Dashboard e/o Tickets
7. **Test end-to-end**: inviare messaggio WhatsApp di test e verificare creazione ticket
