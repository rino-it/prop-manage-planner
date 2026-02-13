# 📘 PropManage Planner - Documentazione Tecnica & Logica
**Ultimo Aggiornamento:** 17 Dicembre 2025
**Stato Progetto:** Stabile (Post-Rollback & Fix UI Tenant)

---

## 1. Architettura & Tech Stack
* **Frontend:** React (Vite), TypeScript, Tailwind CSS, Shadcn/UI.
* **Backend/DB:** Supabase (PostgreSQL).
* **State Management:** TanStack Query (React Query).
* **Hosting:** Vercel.

---

## 2. Moduli Core e Funzionalità

### A. Reportistica Finanziaria (`SuggestedPlan.tsx`)
**Stato:** ✅ Funzionante e Stabile.
**Logica:**
* Permette di selezionare un **range di date personalizzato** (Dal... Al...).
* Filtra per **Singola Proprietà** o **Portafoglio Completo**.
* **Dati:**
    * *Incassi:* Tabella `tenant_payments` (solo stato = 'pagato').
    * *Spese:* Tabella `property_expenses`.
* **Output:** Calcola Totale Entrate, Uscite e Utile Netto. Include il logo ufficiale SVG.
* **Stampa:** Nasconde l'interfaccia e genera un PDF pulito.

### B. Portale Inquilino / Guest Portal (`TenantPortal.tsx`)
**Stato:** ✅ Funzionante (UI Aggiornata).
**Logica "Smart Access" a 4 Step:**
Il portale guida l'inquilino in un imbuto sequenziale per garantire sicurezza e conformità legale.

1.  **Step 1: Contatti** (🔴 Bloccante)
    * L'utente *deve* inserire Email e Telefono.
    * Salvataggio su DB (`bookings.guest_email`, `bookings.guest_phone`).
2.  **Step 2: Caricamento Documenti** (🔴 Bloccante)
    * L'utente carica Carta d'Identità/Codice Fiscale.
    * File salvati in Supabase Storage bucket `documents`.
    * Record creato in `booking_documents` con status `in_revisione`.
    * L'interfaccia mostra subito la lista dei file caricati ("In Attesa").
3.  **Step 3: Verifica Host** (🟡 Attesa)
    * L'inquilino vede un messaggio giallo: "Documenti ricevuti, attesa verifica".
    * **Le chiavi rimangono nascoste.**
    * L'Host deve approvare manualmente (campo DB: `bookings.documents_approved = true`).
4.  **Step 4: Accesso Sbloccato** (🟢 Successo)
    * Solo se `documents_approved === true`.
    * Mostra: Codice Keybox (grande), WiFi, Link Video YouTube, Posizione Maps.

**Altre Funzioni nel Portale:**
* **Pagamenti:** Lista scadenze affitti/spese. L'inquilino può segnalare "Pagato" (passa a stato `in_verifica`).
* **Storico Documenti:** Lista visibile di tutti i file inviati.

---

## 3. Struttura Database (Supabase)

### Tabella: `properties_real` (Proprietà)
Campi critici per l'automazione check-in:
* `checkin_guide` (text): Istruzioni testuali.
* `checkin_video_url` (text): Link YouTube.
* `keybox_code` (text): Il codice segreto della cassetta.
* `wifi_ssid` (text): Nome rete.
* `wifi_password` (text): Password rete.

### Tabella: `bookings` (Prenotazioni)
Campi per la gestione flusso:
* `guest_email` (text): Contatto ospite.
* `guest_phone` (text): Telefono ospite.
* `documents_approved` (boolean): **Interruttore principale**. False = Chiavi nascoste / True = Chiavi visibili.
* `online_checkin_completed` (boolean): (Legacy, ora usiamo la logica a step).

### Tabella: `booking_documents`
* `booking_id`: Link alla prenotazione.
* `file_url`: Path del file nello storage.
* `status`: 'in_revisione' | 'approvato' | 'rifiutato'.

---

## 4. Log delle Versioni & Git (Recenti)

* **Commit Critico (Attuale):** `fix: cleanup tenant portal ui...`
    * *Cosa fa:* Pulisce l'UI del portale inquilini. Rimuove la chat inutile in basso. Mostra immediatamente i file caricati. Timeline visuale in alto.
* **Rollback Precedente:** Abbiamo dovuto fare un `git reset --hard` per eliminare una versione che aveva rotto il Report Finanziario.
    * *Lezione appresa:* Non sovrascrivere file interi se non necessario. Aggiungere funzioni senza rompere le esistenti.

---

## 5. Problemi Aperti / To-Do List

1.  **Pannello Admin per Approvazione:** Attualmente l'Host deve approvare i documenti via Database (SQL o Table Editor) settando `documents_approved = true`. Manca un bottone nell'interfaccia Host per farlo comodamente.
2.  **Verifica SMS:** L'invio di OTP reale (codice sul telefono) non è implementato (richiede provider esterno a pagamento). Attualmente ci fidiamo dell'input utente.

---