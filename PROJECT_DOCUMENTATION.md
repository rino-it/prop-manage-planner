# PropManage Planner - Documentazione Tecnica & Logica
**Ultimo Aggiornamento:** 24 Marzo 2026
**Stato Progetto:** Step 8 completato - Integrazione complessiva

---

## 1. Architettura & Tech Stack
* **Frontend:** React 18 (Vite), TypeScript, Tailwind CSS, Shadcn/UI (50+ componenti).
* **Backend/DB:** Supabase (PostgreSQL), Edge Functions.
* **State Management:** TanStack Query (React Query).
* **Hosting:** Vercel.
* **Pagamenti:** Stripe.
* **i18n:** IT, EN, DE, FR.

---

## 2. Struttura Navigazione (Sidebar)

La sidebar e organizzata in 5 sezioni logiche:

* **Operativo:** Homepage (Dashboard), Calendario, Prenotazioni, Messaggi
* **Gestione:** Proprieta, Inquilini, Accoglienza, Prezzi, Parco Mezzi
* **Finanziario:** Incassi, Spese, Statistiche
* **Integrazioni:** Portali, Marketplace
* **Admin:** Team, Servizi, Ticket & Guasti, Attivita

---

## 3. Moduli e Componenti

### A. Homepage / Dashboard (`Dashboard.tsx`)
**Stato:** Funzionante.
* KPI mensili: Incassato, Previsione, Uscite.
* Quick stats: conteggio proprieta, prenotazioni attive, ticket aperti, attivita attive.
* Widget Stato Portali con dati reali da `portal_connections`.
* Widget Setup Checklist con progressione reale.
* Widget Marketplace con link al catalogo completo.
* Centro Notifiche con urgenze (scadenze, ticket, pagamenti).
* Accesso rapido a Calendario, Statistiche, Prezzi.

### B. Proprieta (`Properties.tsx`)
**Stato:** Funzionante.
* CRUD proprieta immobiliari e veicoli.
* Gestione documenti con OCR.
* Mappa (LocationIQ), impostazioni pagamento, ticket per proprieta.

### C. Prenotazioni (`Bookings.tsx`)
**Stato:** Funzionante.
* Gestione prenotazioni brevi e lunghi soggiorni.
* Link a portali Guest e Tenant.

### D. Portali (`PortalConnections.tsx`)
**Stato:** Funzionante (struttura).
* Connessione Airbnb, Booking.com, VRBO, iCal.
* Stato sync e ultimo aggiornamento.

### E. Marketplace (`Marketplace.tsx`)
**Stato:** Funzionante.
* Catalogo 8 servizi reali: Yaago, Chekin, Turno, Properly, PriceLabs, Beyond, ProHost, Hostaway.
* Filtro per categoria (accoglienza, pulizie, prezzi, operativo) e ricerca testuale.
* Link esterni ai provider.

### F. Prezzi (`Pricing.tsx`)
**Stato:** Funzionante (base).
* Visualizzazione prezzi per notte, mensile e pulizie per ogni proprieta.
* Dati letti da `properties_real` (prezzo_notte, prezzo_mensile, prezzo_pulizie).
* Placeholder per pricing dinamico (Step 7).

### G. Reportistica Finanziaria (`SuggestedPlan.tsx`)
**Stato:** Funzionante.
* Range date personalizzato, filtro per proprieta.
* Dati: `tenant_payments` (pagato) e `property_expenses`.
* Stampa PDF con layout professionale.

### H. Portale Inquilino / Guest Portal (`TenantPortal.tsx`)
**Stato:** Funzionante.
* Flusso "Smart Access" a 4 step: Contatti -> Documenti -> Verifica Host -> Accesso.
* Pagamenti via Stripe, gestione documenti, messaging.

### I. Portale Ospite (`GuestPortal.tsx`)
**Stato:** Funzionante.
* Tab: Experiences, Extra, Documents, Help, Status, Services, Files.
* Upload documenti con OCR, pagamento servizi, creazione ticket.

### J. Statistiche (`Statistics.tsx`)
**Stato:** Funzionante.
* Occupancy rate, ADR, RevPAR.
* Grafici Recharts: income vs expenses, trend prenotazioni, top properties.

### K. Ticket & Guasti (`Tickets.tsx`)
**Stato:** Funzionante.
* CRUD ticket con priorita, stato, allegati, assegnazione team.
* AI triage (Edge Function Gemini).
* Export PDF, import CSV.

### L. Inquilini (`TenantManager.tsx`)
**Stato:** Funzionante.
* Lista inquilini long-term con azioni rapide (WhatsApp, Calendar).
* Storico ticket e pagamenti per inquilino.

### M. Messaggi (`Messages.tsx`)
**Stato:** Base (struttura).

### N. Accoglienza (`Accoglienza.tsx`)
**Stato:** Parziale.
* Sub-route: Guest Guide, Approvazione Documenti, Comunicazione.

### O. Spese (`Expenses.tsx`)
**Stato:** Funzionante.
* CRUD spese per proprieta immobiliari e veicoli.
* Categorie, stato pagamento, competenza (owner/tenant).

### P. Incassi (`Revenue.tsx`)
**Stato:** Funzionante.
* Piani pagamento ricorrenti, mark as paid.

### Q. Team, Servizi, Attivita
**Stato:** Funzionanti.

---

## 4. Struttura Database (Supabase)

### Tabelle principali
* `properties_real` - Proprieta immobiliari (con campi check-in: keybox_code, wifi_ssid, wifi_password, checkin_guide, checkin_video_url, prezzo_notte, prezzo_mensile, prezzo_pulizie)
* `properties_mobile` - Veicoli/mezzi
* `bookings` - Prenotazioni (con documents_approved, guest_email, guest_phone)
* `booking_documents` - Documenti ospiti (status: in_revisione/approvato/rifiutato)
* `tenant_payments` - Pagamenti inquilini
* `payments` - Spese/uscite
* `tickets` - Manutenzione e guasti
* `portal_connections` - Connessioni portali
* `activities` - Attivita ricorrenti
* `services` - Servizi per ospiti
* `profiles` - Profili utente
* `tenant_profiles` - Profili inquilini
* `messages` - Messaggi
* `documents` - Documenti proprieta

---

## 5. Routing

Tutte le rotte sono nested dentro il layout principale (`Index.tsx`):

| Path | Componente | Sezione |
|------|-----------|---------|
| `/` | Dashboard | Operativo |
| `/calendario` | CalendarView | Operativo |
| `/bookings` | Bookings | Operativo |
| `/messaggi` | Messages | Operativo |
| `/properties` | Properties | Gestione |
| `/tenants` | TenantManager | Gestione |
| `/accoglienza` | Accoglienza | Gestione |
| `/prezzi` | Pricing | Gestione |
| `/mobile-properties` | MobileProperties | Gestione |
| `/revenue` | Revenue | Finanziario |
| `/expenses` | Expenses | Finanziario |
| `/statistiche` | Statistics | Finanziario |
| `/portali` | PortalConnections | Integrazioni |
| `/marketplace` | Marketplace | Integrazioni |
| `/team` | Team | Admin |
| `/services` | Services | Admin |
| `/tickets` | Tickets | Admin |
| `/activities` | Activities | Admin |

Rotte pubbliche: `/auth`, `/guest/:id`, `/guest/auto`, `/tenant/:id`.

---

## 6. Problemi Aperti / To-Do

1. **Pannello Admin per Approvazione Documenti:** L'Host deve approvare via DB (`documents_approved = true`). Manca un bottone nell'interfaccia.
2. **Verifica SMS:** OTP non implementato (richiede provider esterno a pagamento).
3. **Pricing Dinamico (Step 7):** Regole stagionalita, last-minute, sconti lunghi soggiorni - placeholder presente.
4. **Integrazione API Portali (Step 5):** La struttura esiste, le API di sync non sono ancora collegate.
5. **Messaggi:** Componente base, da espandere con template e automazioni.

---
