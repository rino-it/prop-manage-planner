# 🗺️ Mappa Database Supabase (Aggiornata al 18/12/2025)

Questo documento riflette la struttura REALE estratta dal database.
**Regola d'oro:** Quando colleghi Ticket e Spese, ricorda che i nomi delle colonne cambiano!

## 1. 🎫 Tabella: `tickets` (Segnalazioni)
| Colonna REALE | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | uuid | ID univoco del ticket |
| `property_real_id` | uuid | **ATTENZIONE:** Qui si chiama `_real_id` |
| `titolo` | text | Titolo del problema |
| `descrizione` | text | Dettagli |
| `stato` | text | `aperto`, `in_lavorazione`, `in_attesa`, `in_corso`, `risolto` |
| `priorita` | text | `bassa`, `media`, `alta` |
| `quote_amount` | numeric | Importo preventivo (€) |
| `quote_url` | text | Link al file preventivo (PDF/IMG) |
| `quote_status` | text | `pending`, `approved`, `rejected` |
| `cost` | numeric | Costo finale consuntivo |
| `ricevuta_url` | text | Link allo scontrino finale |
| `admin_notes` | text | Note interne |
| `supplier` | text | Nome Fornitore |

## 2. 💰 Tabella: `property_expenses` (Spese Contabili)
*Questa è la tabella visualizzata nella Dashboard.*

| Colonna REALE | Tipo | Note Integrazione |
| :--- | :--- | :--- |
| `id` | uuid | ID Spesa |
| `property_id` | uuid | **ATTENZIONE:** Qui si chiama solo `property_id` |
| `amount` | numeric | Importo (corrisponde a `quote_amount` del ticket) |
| `description` | text | Descrizione (corrisponde a `titolo` del ticket) |
| `date` | date | Data della spesa |
| `category` | text | Es: `manutenzione` (è un campo di testo libero) |
| `attachment_url` | text | Link al file (Preventivo o Fattura) |
| `user_id` | uuid | Chi ha inserito la spesa |
| `supplier` | text | Fornitore |

## 🚫 Tabelle da IGNORARE
* **`payments`**: Tabella duplicata con colonne in italiano (`importo`). **NON USARE.**
* **`maintenance_expenses`**: Vecchia tabella non collegata alla dashboard. **NON USARE.**