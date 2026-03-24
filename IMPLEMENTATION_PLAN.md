# PropManage Planner - Piano di Implementazione

**Data:** 23 Marzo 2026
**Basato su:** Diagramma Excalidraw (sitemap/wireframe) + stato attuale del codebase

---

## Mappa: Diagramma vs Stato Attuale

| Modulo nel Diagramma         | Componente Esistente       | Stato        |
|------------------------------|----------------------------|--------------|
| HOMEPAGE (Dashboard)         | `Dashboard.tsx`            | Funzionante  |
| CALENDARIO                   | Integrato in Dashboard     | Parziale     |
| PRENOTAZIONE                 | `Bookings.tsx`             | Funzionante  |
| MESSAGGI                     | Non presente               | Da creare    |
| COMUNICAZIONE                | Non presente               | Da creare    |
| ACCOGLIENZA                  | `GuestPortal.tsx` / `TenantPortal.tsx` | Parziale |
| GUIDA PER GLI OSPITI         | Campi in `properties_real` | Solo dati    |
| STATISTICHE                  | Non presente               | Da creare    |
| PREZZI                       | Non presente               | Da creare    |
| PORTALI DI PRENOTAZIONE      | Non presente               | Da creare    |
| MARKETPLACE                  | Non presente               | Da creare    |

---

## Step 1 - Ristrutturazione Homepage e Calendario

**Obiettivo:** Trasformare la Dashboard attuale nella Homepage del diagramma, con le tre sezioni chiave visibili: stato dei portali, prime cose da fare, marketplace.

**Cosa fare:**

1.1. Aggiungere al `Dashboard.tsx` una sezione "Stato Portali" — widget che mostra lo stato di connessione dei portali esterni (inizialmente placeholder statico, diventa dinamico allo Step 5).

1.2. Aggiungere una sezione "Prime Cose da Fare" — la webapp analizza cosa manca nella configurazione (es. proprietà senza indirizzo, nessun portale connesso, informazioni di contatto mancanti) e genera un elenco con link diretti al path da completare.

1.3. Aggiungere un widget "Marketplace" — anteprima dei servizi integrabili con link alla pagina dedicata (Step 6).

1.4. Separare il Calendario in un componente standalone `CalendarView.tsx`, rimuoverlo dalla Dashboard e aggiungerlo come route dedicata `/calendario`.

1.5. Il Calendario deve mostrare due sotto-sezioni: "Prossimi Eventi" (check-in/check-out imminenti) e "Ultime Attività" (prenotazioni, modifiche, cancellazioni recenti). Quando vuote, mostrare i messaggi placeholder definiti nel diagramma.

**Output:** Nuova route `/calendario`, Dashboard riorganizzata con i 3 widget.

**Stima:** 3-4 giorni

---

## Step 2 - Modulo Messaggi e Comunicazione

**Obiettivo:** Creare il sistema di messaggistica interna e il modulo comunicazione verso gli ospiti.

**Cosa fare:**

2.1. Creare la tabella `messages` su Supabase con campi: id, booking_id, property_id, sender_type (host/guest/system), content, channel (whatsapp/email/internal), read, created_at.

2.2. Creare il componente `Messages.tsx` — vista inbox con lista messaggi raggruppati per prenotazione/inquilino, filtri per canale e stato letto/non letto.

2.3. Aggiungere route `/messaggi` e voce nel Sidebar.

2.4. Creare il componente `Communication.tsx` — pannello per inviare comunicazioni (template predefiniti per check-in, promemoria pagamento, benvenuto). Questo diventa il punto di raccordo tra Messaggi, Accoglienza e WhatsApp Bot (Step futuro da project instructions).

2.5. Collegare la Comunicazione all'Accoglienza: quando un ospite completa uno step nel TenantPortal, il sistema genera un messaggio automatico nella inbox.

**Output:** Nuove route `/messaggi` e `/comunicazione`, tabella DB, notifiche automatiche.

**Stima:** 4-5 giorni

---

## Step 3 - Accoglienza e Guida per gli Ospiti

**Obiettivo:** Potenziare il flusso guest esistente e creare la sezione "Guida per gli Ospiti" come pagina dedicata lato host.

**Cosa fare:**

3.1. Creare `GuestGuide.tsx` — pagina lato host dove configurare per ogni proprietà: istruzioni check-in (testo), video YouTube, codice keybox, WiFi, mappa, regole della casa. I dati esistono già in `properties_real` ma manca un'interfaccia dedicata per gestirli.

3.2. Collegare la Guida Ospiti al flusso Comunicazione: possibilità di inviare la guida via link o messaggio diretto.

3.3. Migliorare il `TenantPortal.tsx` esistente: aggiungere il pannello admin mancante (punto 1 dei to-do aperti) per approvare documenti direttamente dall'interfaccia host, senza passare dal DB.

3.4. Aggiungere route `/accoglienza` con sotto-navigazione: Comunicazione e Guida Ospiti.

**Output:** Interfaccia host per gestione guide, bottone approvazione documenti, route `/accoglienza`.

**Stima:** 3-4 giorni

---

## Step 4 - Modulo Statistiche

**Obiettivo:** Dashboard analitica con le metriche chiave per la gestione degli appartamenti.

**Cosa fare:**

4.1. Creare `Statistics.tsx` con le seguenti metriche (dedotte dal diagramma e dal contesto property management):

- Tasso di occupazione (per proprietà e portafoglio) — visualizzazione con progress circolare
- Revenue per notte media (ADR - Average Daily Rate)
- RevPAR (Revenue Per Available Room)
- Incassi vs Spese per periodo (grafico a barre)
- Trend prenotazioni mese su mese
- Top proprietà per rendimento
- Tasso di cancellazione
- Tempo medio tra prenotazione e check-in

4.2. I dati vengono dalle tabelle esistenti: `bookings`, `tenant_payments`, `property_expenses`, `properties_real`.

4.3. Usare Recharts (gia disponibile nell'ecosistema React) per i grafici.

4.4. Aggiungere filtri: periodo (mese/trimestre/anno), proprietà singola vs portafoglio.

4.5. Aggiungere route `/statistiche` e voce nel Sidebar.

**Output:** Pagina statistiche completa con grafici e KPI.

**Stima:** 4-5 giorni

---

## Step 5 - Portali di Prenotazione (Connessione API)

**Obiettivo:** Integrare i portali di prenotazione esterni (Airbnb, Booking.com, ecc.) tramite un channel manager.

**Cosa fare:**

5.1. Ricerca e selezione del channel manager da integrare. Opzioni principali:
- **Smoobu API** (citato esplicitamente nel diagramma) — ha API REST documentata, piano gratuito limitato
- **Hospitable** — alternativa con API
- **iCal sync** — fallback minimale senza API (importa calendari .ics)

Raccomandazione: partire con iCal sync come MVP (zero costi, funziona subito), poi evolvere verso Smoobu API.

5.2. Creare la tabella `portal_connections` su Supabase: id, user_id, portal_name, connection_type (ical/api), credentials (encrypted), status, last_sync, property_id.

5.3. Creare `PortalConnections.tsx` — pagina per connettere/disconnettere portali, vedere stato sincronizzazione, log errori.

5.4. Creare un Edge Function Supabase `sync-portals` che gira su schedule (o trigger manuale) per importare prenotazioni dai portali connessi nella tabella `bookings`.

5.5. Aggiornare il widget "Stato Portali" nella Homepage (Step 1.1) per mostrare dati reali.

5.6. Aggiungere route `/portali` e voce nel Sidebar.

**Output:** Sincronizzazione prenotazioni da portali esterni, pagina gestione connessioni.

**Stima:** 5-7 giorni

---

## Step 6 - Marketplace Servizi

**Obiettivo:** Creare la vetrina di servizi integrabili (come indicato nel diagramma con Yaago, Turno, ProHost Solutions, ecc.).

**Cosa fare:**

6.1. Creare `Marketplace.tsx` — pagina catalogo con card per ogni servizio integrabile, organizzati per categoria:
- Accoglienza digitale (es. Yaago — welcome booklet interattivo)
- Pulizie e turnover (es. Turno — gestione servizi pulizia)
- Prezzi dinamici (es. Smoobu Dynamic Pricing)
- Ottimizzazione operativa (es. ProHost Solutions)

6.2. Ogni card mostra: nome, descrizione, stato (connesso/disponibile), CTA per attivare.

6.3. Per l'MVP, il marketplace e' un catalogo statico con link esterni. Le integrazioni reali vengono aggiunte incrementalmente:
- Fase A: link esterni + documentazione
- Fase B: integrazione API per i servizi che lo supportano (collegato allo Step 5)

6.4. Aggiungere route `/marketplace` e voce nel Sidebar.

**Output:** Pagina marketplace, catalogo servizi.

**Stima:** 2-3 giorni

---

## Step 7 - Modulo Prezzi Dinamici

**Obiettivo:** Gestione prezzi per proprietà con possibilità di pricing dinamico.

**Cosa fare:**

7.1. Creare la tabella `pricing_rules` su Supabase: id, property_id, base_price, min_price, max_price, strategy (manual/dynamic), season_adjustments (jsonb), created_at.

7.2. Creare `Pricing.tsx` — pagina con:
- Vista prezzi correnti per proprietà
- Editor regole: prezzo base, min/max, aggiustamenti stagionali
- Preview calendario prezzi (visualizzazione mensile con prezzo per notte)

7.3. Integrazione con Smoobu Dynamic Pricing (se attivato nello Step 5): la pagina mostra i prezzi suggeriti dall'algoritmo e permette di accettarli o sovrascriverli.

7.4. Aggiungere route `/prezzi` e voce nel Sidebar.

**Output:** Gestione prezzi per proprietà, base per pricing dinamico futuro.

**Stima:** 3-4 giorni

---

## Step 8 - Integrazione Complessiva e Polish

**Obiettivo:** Collegare tutti i moduli, aggiornare la navigazione, test end-to-end.

**Cosa fare:**

8.1. Aggiornare `Sidebar.tsx` con tutte le nuove voci di menu, organizzate per sezione logica:
- Operativo: Dashboard, Calendario, Prenotazioni, Messaggi
- Gestione: Proprietà, Inquilini, Accoglienza, Prezzi
- Finanziario: Incassi, Spese, Statistiche
- Integrazioni: Portali, Marketplace
- Admin: Team, Servizi

8.2. Aggiornare la Homepage con dati reali da tutti i moduli (widget stato portali, cose da fare, marketplace highlights).

8.3. Test completo di tutti i flussi: creazione proprietà -> connessione portale -> ricezione prenotazione -> comunicazione ospite -> check-in -> statistiche.

8.4. Verifica responsive/mobile su tutti i nuovi componenti.

8.5. Aggiornare `PROJECT_DOCUMENTATION.md` con i nuovi moduli.

**Output:** App completa e coerente con il diagramma.

**Stima:** 3-4 giorni

---

## Riepilogo Tempi

| Step | Modulo                        | Giorni Stimati |
|------|-------------------------------|----------------|
| 1    | Homepage + Calendario         | 3-4            |
| 2    | Messaggi + Comunicazione      | 4-5            |
| 3    | Accoglienza + Guida Ospiti    | 3-4            |
| 4    | Statistiche                   | 4-5            |
| 5    | Portali di Prenotazione       | 5-7            |
| 6    | Marketplace                   | 2-3            |
| 7    | Prezzi Dinamici               | 3-4            |
| 8    | Integrazione + Polish         | 3-4            |
| **Totale**  |                        | **27-36 giorni** |

---

## Dipendenze tra Step

```
Step 1 (Homepage) ──> Step 5 (Portali) ──> Step 7 (Prezzi)
                  ──> Step 6 (Marketplace)
Step 2 (Messaggi) ──> Step 3 (Accoglienza)
Step 4 (Statistiche) e' indipendente (usa dati esistenti)
Step 8 richiede tutti gli step precedenti
```

Gli Step 1-4 possono procedere in parallelo. Lo Step 5 (Portali) e' il piu critico perche sblocca Step 6 e 7.

---

## Note Architetturali

- Ogni nuovo modulo segue il pattern esistente: componente React + query TanStack + tabella Supabase.
- Nessun mock o placeholder con dati finti. Se un dato non esiste ancora, il componente mostra uno stato vuoto con CTA per popolare.
- Le Edge Functions Supabase vengono usate per la logica server-side (sync portali, notifiche automatiche).
- Il diagramma include screenshot di riferimento da altre piattaforme (PrimeStay, Smoobu). Questi servono come ispirazione UX, non come specifiche da copiare. La UX/Figma si fa dopo, come da project instructions.
