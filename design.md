# Design — PropManager (EDV Costruzioni)

Sistema di design bloccato per l'app. Ogni redesign di pagina legge questo file
prima di scrivere codice. Non rigenerare per pagina — estendi/modifica qui.

> Nota formato: l'app usa shadcn/ui, quindi i token colore restano in **HSL**
> (`hsl(var(--token))`) dentro `src/index.css`. Le sezioni OKLCH della pipeline
> Hallmark sono adattate al vincolo HSL del progetto.

## Genre
modern-minimal (gestionale B2B / fintech interno)

## Macrostructure family
- App pages (Spese, Cassa, Incassi, Statistiche, …): **Workbench** — header di pagina
  con titolo display + azioni a destra, fascia di stat-card, contenuto denso a righe/tabelle.
- Content/config pages: stessa shell, contenuto a una colonna.
- Non ci sono pagine marketing (app interna).

## Theme — Iris / Indaco (light)
Token in `src/index.css` (HSL). Valori chiave:
- `--background` 40 18% 98%  (paper off-white caldo)
- `--foreground` 240 12% 12% (inchiostro neutro)
- `--card` 0 0% 100%
- `--primary` 245 55% 52%  (iris/indaco — accent unico)
- `--primary-foreground` 0 0% 100%
- `--muted` 40 14% 95.5% · `--muted-foreground` 240 6% 44%
- `--border`/`--input` 40 13% 89% (hairline caldo)
- `--ring` 245 55% 52%
- `--radius` 0.625rem

Stati semantici **invariati** (non sono l'accent):
- success (verde) — Paga / Pagato
- warning (ambra) — In attesa / scadenza vicina
- danger (rosso) — Scaduto / spese
- info → allineato all'indaco (245 55% 52%)

## Typography
- Display: **Space Grotesk**, weight 600/700, style normal — titoli pagina, totali, numeri grandi
- Body/UI: **Inter**, weight 400/500/600
- Mono: ui-monospace (fallback di sistema) — usato raramente (ID/codici)
- Numeri valuta: sempre `tabular-nums`
- Display tracking: -0.012em sui titoli
- Caricamento font: Google Fonts in `index.html`; famiglie in `tailwind.config.ts`
  (`font-sans` = Inter su tutto il body, `font-display` = Space Grotesk)

## Spacing
Scala 4-pt di Tailwind (gap-*, p-*, space-*). Usare le utility, non valori grezzi.

## Motion
Progetto **motion-cut** (solo `tailwindcss-animate`).
- Transizioni hover/focus ≤ 150 ms su `transform`/`opacity`/colore.
- Focus ring visibile e immediato (mai animato), via `--ring`.
- Rispettare `prefers-reduced-motion`.

## Microinteractions stance
- Successo silenzioso / toast solo per conferme reali (già con `sonner`/use-toast).
- Hover su elementi interattivi: cambio superficie tenue (`muted`/`primary/8`).

## CTA voice
- Primario: fill `--primary` (indaco), testo bianco, radius `--radius`, verbo imperativo.
- Distruttivo/azione di stato (Paga): resta verde `success` — è semantica, non brand.
- Secondario: `variant="outline"` su hairline `--border`.

## Cosa le pagine DEVONO condividere
- Wordmark "PropManager" + logo.
- Accent indaco e suo uso parsimonioso (link/attivo sidebar, bottoni primari, focus).
- Font display + body.
- Voce CTA (forma bottone, radius, padding).
- Ritmo header di pagina (titolo display + conteggio/azioni).

## Cosa le pagine POSSONO variare
- Disposizione delle stat-card e densità delle righe per tipo di dato.
- Presenza/assenza di filtri e tab.

## Stato applicazione
- Phase A (questo commit): token + tipografia + radius → re-skin globale; header pagina in display.
- Phase B: rifinitura strutturale di Spese e Cassa (stat-card, numeri in display, ritmo righe).

## Exports

### tokens.css (HSL, shadcn-compatibile)
Vedi `tokens.css` al root del progetto. Per riuso esterno, mappare:
`--background`→paper, `--foreground`→ink, `--primary`→accent, `--border`→rule,
`--ring`→focus. Font: display = Space Grotesk, body = Inter.
