# PropManage - Piano UX/Design System
## Riferimento visivo: PrimeStay + Shadcn/UI

Data: 2026-03-24
Stato: PIANO DEFINITO - Da approvare schermata per schermata prima di implementare

---

## 1. Analisi Stato Attuale

### Moduli con logica backend funzionante (14 moduli production-ready)
| Modulo | Componente | Backend | Pronto per UX |
|--------|-----------|---------|---------------|
| Dashboard | Dashboard.tsx | Query dirette Supabase | SI |
| Proprieta | Properties.tsx (38KB) | CRUD + geocoding + docs | SI |
| Prenotazioni | Bookings.tsx (40KB) | Stripe + email + schedule | SI |
| Inquilini | TenantManager.tsx | CRUD + assegnazione | SI |
| Ticket | TicketManager.tsx (37KB) + Tickets.tsx | WhatsApp + AI triage | SI |
| Incassi | Revenue.tsx | Payment schedules | SI |
| Spese | Expenses.tsx (492 righe) | CRUD + categorie | SI |
| Parco Mezzi | MobileProperties page | CRUD veicoli | SI |
| Attivita | Activities.tsx | Activity stream | SI |
| Team | Team.tsx | Gestione team | SI |
| Servizi | Services.tsx | CRUD servizi | SI |
| Guest Portal | GuestPortal.tsx (753 righe) | Upload docs + AI OCR | SI |
| Tenant Portal | TenantPortal.tsx (629 righe) | Pagamenti + docs | SI |
| Notifiche | NotificationBell + Admin | Real-time polling | SI |

### Moduli NON ancora pronti per UX (logica mancante)
| Modulo | Stato | Blocco |
|--------|-------|--------|
| Messaggi | Non esiste | Nessun schema DB |
| Comunicazione | Non esiste | Nessun schema DB |
| Statistiche | Non esiste | Nessun schema DB (dati ci sono, manca aggregazione) |
| Portali Prenotazione | Solo iCal MVP | Serve API Smoobu/Booking.com |
| Marketplace | Non esiste | Da definire |
| Prezzi / Dynamic Pricing | Non esiste | Da definire |

**Conclusione**: 14 schermate sono pronte per il redesign UX. 6 moduli richiedono prima la logica.

---

## 2. Design System - Fondamenta

### 2.1 Ispirazione PrimeStay - Pattern da adottare

Dall'analisi dello screenshot PrimeStay, i pattern chiave da portare in PropManage:

**Layout Generale**
- Sidebar fissa a sinistra (240px) con sfondo bianco e bordo destro sottile
- Header contestuale per pagina con titolo + azioni primarie (Import, Add)
- Area contenuto con sfondo grigio chiaro (gia presente: `bg-gray-50`)
- Sezioni raggruppate nella sidebar (QUICK ACTIONS, MENU, HELP & SUPPORT)

**Navigazione Sidebar**
- Barra di ricerca globale in cima (cmd+k gia disponibile via cmdk)
- Menu raggruppato per sezioni logiche con label uppercase grigia
- Icone monocromatiche (non colorate come ora) per un look piu pulito
- Profilo utente con avatar + email in fondo alla sidebar
- Item attivo: sfondo accent leggero + bordo sinistro o testo bold

**Data Tables (Pattern dominante PrimeStay)**
- Thumbnail immagine + nome/indirizzo nella prima colonna
- Colonne: Type, Status (badge colorato), metriche numeriche, Action
- Badge di stato: verde "Occupied" / arancione "Vacant" con dot indicator
- Indicatori circolari per percentuali (occupancy rate)
- Pulsante "View" uniforme come azione principale
- Contatore totale ("Total 19") accanto al titolo
- Barra filtri: Search + dropdown filtri + pulsante Filter

**Palette Colori (adattata a PropManage)**
- Primario: mantenere il blu attuale `221.2 83.2% 53.3%` (coerente con PrimeStay)
- Status: Verde per attivo/pagato, Arancione per in attesa, Rosso per scaduto/urgente
- Sidebar: monocromatica (icone grigie, non colorate)
- Accento minimo: solo dove serve attirare attenzione

### 2.2 Tokens gia configurati (da mantenere)
- CSS variables HSL in `index.css` - OK
- Tailwind extend colors - OK
- Shadcn/UI components (51) - OK
- Border radius 0.75rem - OK
- Dark mode support - OK

### 2.3 Tokens da aggiungere
```css
/* Nuovi tokens per allineamento PrimeStay */
--sidebar-width: 240px;
--header-height: 64px;
--table-row-height: 72px;
--section-label: 11px; /* uppercase section labels */
```

### 2.4 Tipografia
- Titolo pagina: `text-2xl font-bold text-foreground` (come "Portfolio" in PrimeStay)
- Contatore: `text-base font-normal text-muted-foreground` (come "Total 19")
- Label sezione sidebar: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
- Voce sidebar: `text-sm font-medium`
- Celle tabella: `text-sm text-foreground`
- Indirizzo sotto nome: `text-xs text-muted-foreground`

---

## 3. Piano Schermata per Schermata

### Priorita di redesign (ordine di impatto)

#### FASE 1: Shell + Navigazione (impatto su TUTTE le pagine)

**3.1 Sidebar - Redesign**
- Stato attuale: icone colorate, lista piatta, nessun raggruppamento
- Target PrimeStay: icone monocromatiche, sezioni raggruppate, search, profilo utente

```
PROPOSTA STRUTTURA:
------------------------------
[Logo] PropManager    [toggle]
------------------------------
[Search bar] (cmd+k)
------------------------------
PANORAMICA
  Dashboard
  Calendario (futuro)
------------------------------
GESTIONE
  Proprieta
  Prenotazioni
  Inquilini
  Parco Mezzi
------------------------------
OPERATIVO
  Ticket & Guasti
  Attivita
  Servizi
  Team
------------------------------
FINANZIARIO
  Incassi
  Spese
------------------------------
SUPPORTO
  Impostazioni (futuro)
------------------------------
[Avatar] Rino
kristian.rinaldi.01@...
------------------------------
```

Modifiche tecniche:
- Rimuovere `color` da ogni menuItem (icone tutte `text-muted-foreground`, attiva `text-foreground`)
- Aggiungere sezioni con label uppercase
- Integrare search bar con `cmdk` (gia in deps)
- Aggiungere profilo utente dal contesto auth
- Item attivo: `bg-accent text-accent-foreground font-semibold` con barra laterale sinistra (2px primary)

**3.2 Header Contestuale**
- Stato attuale: titolo + notification bell, molto basico
- Target: titolo pagina grande + contatore + azioni primarie a destra

```
PROPOSTA:
[Titolo Pagina]  Totale: 12    [Filtri...]    [+ Aggiungi]  [Notifiche]
```

Modifiche tecniche:
- Spostare titolo pagina nell'area contenuto (come PrimeStay), non nell'header fisso
- Header fisso diventa solo: hamburger mobile + logo + notifiche
- Ogni pagina gestisce il proprio titolo + azioni

---

#### FASE 2: Pagine dati tabellari (maggiore impatto visivo)

**3.3 Proprieta - Da Card Grid a Data Table**
- Stato attuale: card grid con molte info per card
- Target PrimeStay: tabella pulita con thumbnail + colonne chiave

```
COLONNE PROPOSTA:
| [Img] Nome / Indirizzo | Tipo | Stato | Unita | Tasso Occ. | Saldo | Azione |
```

- Thumbnail: prima immagine da Supabase storage o placeholder
- Tipo: badge (Residenziale, Commerciale, Turistico)
- Stato: dot + label (Occupato verde, Libero arancione, Manutenzione rosso)
- Tasso Occupazione: cerchio progresso SVG (come PrimeStay)
- Saldo: importo con colore (verde positivo, rosso negativo)
- Azione: pulsante "Vedi" che apre sheet/dialog dettaglio
- Tab superiori: Proprieta | Parco Mezzi | Documenti | Mappa
- Barra filtri: search + dropdown tipo + dropdown stato + bottone filtri

**3.4 Prenotazioni - Data Table**
```
COLONNE PROPOSTA:
| Ospite / Periodo | Proprieta | Check-in | Check-out | Stato Pag. | Documenti | Azione |
```
- Stato Pagamento: progress bar o badge (Caparra pagata, Saldo in attesa, Completo)
- Documenti: icona con contatore (2/3 approvati)
- Filtri: search + proprieta + stato + periodo

**3.5 Inquilini - Data Table**
```
COLONNE PROPOSTA:
| [Avatar] Nome / Contatto | Proprieta | Contratto | Prossimo Pag. | Stato | Azione |
```

**3.6 Ticket & Guasti - Data Table**
```
COLONNE PROPOSTA:
| # ID | Titolo / Proprieta | Priorita | Assegnato a | Stato | Sorgente | Azione |
```
- Priorita: badge colorato (P1 rosso, P2 arancione, P3 giallo, P4 grigio)
- Sorgente: icona (WhatsApp, Portale, Manuale, Email)
- Assegnato: avatar stack

**3.7 Incassi - Data Table**
```
COLONNE PROPOSTA:
| Descrizione / Proprieta | Tipo | Importo | Scadenza | Stato | Azione |
```

**3.8 Spese - Data Table**
```
COLONNE PROPOSTA:
| Descrizione / Fornitore | Proprieta | Categoria | Importo | Scadenza | Stato | Azione |
```

---

#### FASE 3: Dashboard (complessita maggiore)

**3.9 Dashboard - Redesign**
- Stato attuale: calendario + eventi + meteo + card metriche
- Target: KPI cards in alto + tabella attivita recenti + calendario laterale

```
PROPOSTA LAYOUT:
[KPI Card: Proprieta] [KPI Card: Occupazione] [KPI Card: Incassi Mese] [KPI Card: Ticket Aperti]

[Prossimi Check-in/out (tabella)]         [Calendario Mini]
[Pagamenti in Scadenza (tabella)]         [Meteo Proprieta]
[Ticket Urgenti (lista)]                  [AI Digest (se attivo)]
```

KPI Cards stile PrimeStay:
- Numero grande + label + trend (freccia su/giu + percentuale)
- Sfondo bianco, bordo sottile, icona a destra

---

#### FASE 4: Portali Pubblici

**3.10 Guest Portal - Redesign**
- Focus su mobile-first (gli ospiti accedono da telefono)
- Stile: card grandi, bottoni prominenti, stato visuale chiaro
- Sezioni: Info Proprieta > Documenti > Pagamenti > Contatti

**3.11 Tenant Portal - Redesign**
- Simile al guest portal ma con piu funzionalita
- Aggiungere: storico pagamenti, segnala guasto, documenti contratto

---

## 4. Componenti Shadcn/UI da utilizzare per pattern

| Pattern PrimeStay | Componente Shadcn | Note |
|-------------------|-------------------|------|
| Data Table | `DataTable` + `Table` | Gia presente in ui/ |
| Status Badge | `Badge` con varianti custom | Aggiungere varianti status |
| Filtri | `Select` + `Input` + `Button` | Composizione inline |
| Tab Navigation | `Tabs` | Gia in uso |
| Dialog Dettaglio | `Sheet` (side panel) | Migliore di Dialog per dettagli |
| Progress Circle | SVG custom o `Progress` | Da creare componente |
| KPI Card | `Card` con layout specifico | Da creare variante |
| Avatar Stack | `Avatar` multipli sovrapposti | Da creare componente |
| Command Search | `Command` (cmdk) | Gia in deps, da integrare |
| Skeleton Loading | `Skeleton` | Gia presente |

---

## 5. Componenti custom da creare

### 5.1 `OccupancyCircle.tsx`
Cerchio SVG con percentuale (come PrimeStay). Props: value (0-100), size, color.

### 5.2 `StatusDot.tsx`
Dot colorato + label testo. Props: status ('occupied'|'vacant'|'maintenance'), label.

### 5.3 `KpiCard.tsx`
Card metrica con numero, label, trend, icona. Props: title, value, trend, icon.

### 5.4 `PropertyThumbnail.tsx`
Immagine 48x48 rounded con fallback su iniziali/icona. Props: src, name, type.

### 5.5 `AvatarStack.tsx`
Stack di avatar sovrapposti con "+N" overflow. Props: users[], max.

### 5.6 `PageHeader.tsx`
Header standard per ogni pagina: titolo + contatore + slot per azioni.
Props: title, count, children (azioni).

### 5.7 `FilterBar.tsx`
Barra filtri riusabile: search input + slot per dropdown filtri + pulsante reset.

### 5.8 `DataTableShell.tsx`
Wrapper per DataTable con: FilterBar + Table + Pagination + Empty State.

---

## 6. Ordine di Implementazione

```
Sprint 1 (Foundation):
  1. Sidebar redesign (sezioni, icone mono, search, profilo)
  2. PageHeader componente
  3. Header contestuale refactor
  4. Componenti base: StatusDot, KpiCard, PropertyThumbnail

Sprint 2 (Tabelle):
  5. DataTableShell + FilterBar
  6. Proprieta: da card grid a data table
  7. Prenotazioni: data table
  8. Inquilini: data table

Sprint 3 (Operativo + Finanziario):
  9. Ticket: data table con sorgente/priorita
  10. Spese: data table
  11. Incassi: data table
  12. OccupancyCircle, AvatarStack

Sprint 4 (Dashboard):
  13. Dashboard KPI cards
  14. Dashboard tabelle attivita recenti
  15. Integrazione Command Search (cmd+k)

Sprint 5 (Portali):
  16. Guest Portal mobile-first redesign
  17. Tenant Portal redesign
```

---

## 7. Vincoli e Note

1. **Ogni schermata va approvata prima di implementare** - come da project instructions
2. **Nessun dato fittizio** - le tabelle mostrano dati reali da Supabase, stato vuoto con CTA se non ci sono dati
3. **Mobile responsive** - PrimeStay e desktop-first, ma PropManage deve funzionare bene su mobile (sidebar gia gestita con Sheet)
4. **Dark mode** - mantenere il supporto gia presente, verificare contrasti su ogni nuovo componente
5. **Performance** - le tabelle grandi (>50 righe) richiedono virtualizzazione o paginazione server-side
6. **i18n** - ogni nuovo testo UI deve passare dal sistema di traduzione esistente
7. **Pattern esistente** - ogni modulo segue: componente React + query TanStack + tabella Supabase

---

## 8. Decisioni Architetturali

**Raccomandazione: Table View come default, Card View come opzione**
PrimeStay usa esclusivamente tabelle. Per PropManage consiglio di avere la tabella come vista primaria (piu informazione a colpo d'occhio, piu professionale) con un toggle per card view su mobile o per chi preferisce. Motivazione: l'utente gestisce poche proprieta (uso personale), quindi la densita informativa della tabella e piu utile delle card decorative.

**Raccomandazione: Sheet laterale per dettagli, non navigazione a pagina separata**
PrimeStay usa "View" che apre probabilmente un pannello. Consiglio lo stesso pattern con Shadcn Sheet (gia in uso in alcune pagine). Vantaggi: contesto mantenuto, navigazione piu fluida, meno caricamenti.

**Raccomandazione: Sidebar monocromatica**
Le icone colorate attuali (blu, viola, cyan, arancione, verde, rosso...) creano rumore visivo. PrimeStay usa icone tutte dello stesso colore grigio, con l'item attivo leggermente piu scuro. Questo da un aspetto molto piu professionale e pulito.
