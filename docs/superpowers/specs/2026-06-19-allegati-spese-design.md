# Allegati spese — Design

Data: 2026-06-19
Stato: approvato (design), in attesa di review dello spec

## Problema

Le spese (`payments`) non hanno allegati: 0 su 113 record hanno `allegato_url`
valorizzato. L'infrastruttura esiste già (colonna `payments.allegato_url` e
bucket storage `documents`), ma manca completamente la UI lato gestore per
caricare e visualizzare un giustificativo. I nomi tipo "IMU - COLZATE.pdf"
visibili nell'elenco sono solo testo della descrizione, non file reali.

Obiettivo: poter allegare un giustificativo (fattura/ricevuta) a una spesa e
riaprirlo per verifica/riconciliazione.

## Scope

### Fase 1 (questo spec)
Caricamento e visualizzazione di **un** allegato per spesa, dall'interfaccia
delle spese.

### Fase 2 (fuori da questo spec, da progettare dopo)
Link cliccabili ai giustificativi dentro l'estratto conto PDF.

### Esplicitamente fuori scope
- Più allegati per spesa (richiederebbe una tabella dedicata).
- Modifica delle policy/sicurezza del bucket `documents` (vedi Note sicurezza).

## Convenzioni esistenti da seguire

Il progetto già gestisce documenti in `TenantPortal.tsx`:
- Upload su bucket `documents` con `supabase.storage.from('documents').upload(path, file)`.
- Nel DB si salva il **path** del file (non l'URL pubblico).
- Apertura tramite signed URL temporanea:
  `supabase.storage.from('documents').createSignedUrl(path, 60)`.

Questo design riusa la stessa convenzione per coerenza.

## Architettura

Nessuna migrazione DB. Nessun nuovo bucket. Si riusano:
- Colonna `payments.allegato_url` (text, nullable) → conterrà il **path** storage.
- Bucket `documents` (già esistente, pubblico).

Tutto il lavoro è in `src/pages/Expenses.tsx` (form e card spesa), più una piccola
funzione helper per l'apertura del file.

### Formato del path
`spese/{timestamp}_{nomefile_sanificato}`
dove `nomefile_sanificato = file.name.replace(/\s+/g, '_')`.
Il `timestamp` (`Date.now()`) evita collisioni. Il nome originale (sanificato)
resta come ultimo segmento del path, così è possibile derivarne un nome
visualizzabile.

### Helper: apertura allegato
Funzione che, dato il path, crea una signed URL (60s) e apre il file in una
nuova scheda. Specchio di `downloadDoc` già presente in `TenantPortal.tsx`.

### Helper: nome visualizzato
Dato il path, deriva un nome leggibile: ultimo segmento dopo `/`, rimuovendo
il prefisso `{timestamp}_` (regex `^\d+_`). Es.
`spese/1718800000000_Fattura_TARI.pdf` → `Fattura_TARI.pdf`.

## Componenti e flusso

### 1. Stato del form
- Aggiungere `allegato_url: ''` a `DEFAULT_FORM`.
- In apertura modifica (`openEdit`), precaricare `allegato_url: exp.allegato_url || ''`.
- Stato locale aggiuntivo per l'upload in corso: `uploadingAllegato: boolean`.

### 2. Campo "Allegato (fattura/ricevuta)" nel form (Sheet)
Due stati visivi:
- **Nessun file** (`form.allegato_url` vuoto): riquadro tratteggiato con input
  file (`accept="application/pdf,image/*"`). Al cambio file:
  1. Validazione tipo (PDF o immagine) e dimensione (max 10 MB).
  2. Upload su `documents` con il path sopra descritto.
  3. `setForm(f => ({ ...f, allegato_url: path }))`.
  Durante l'upload mostra spinner; **Salva** disabilitato (`disabled` legato a
  `uploadingAllegato`).
- **File presente** (`form.allegato_url` valorizzato): mostra nome file derivato
  + bottone **Apri** (apre signed URL) + bottone **Rimuovi**.
  - **Rimuovi**: best-effort `storage.remove([path])`, poi `allegato_url = ''`.
  - **Sostituzione**: caricando un nuovo file mentre uno è presente, prima si
    elimina (best-effort) il vecchio path, poi si carica il nuovo.

### 3. Salvataggio
Nel payload di `saveExpense` aggiungere `allegato_url: form.allegato_url || null`.
Vale sia per create che per update (la mutation già distingue i due casi).

### 4. Visualizzazione nella card spesa
Nella riga/card della spesa, quando `exp.allegato_url` è presente, mostrare una
piccola icona **graffetta** (Paperclip, lucide-react) accanto ai bottoni
matita/cestino, che apre l'allegato (signed URL, nuova scheda).

## Gestione errori
- File non valido (tipo diverso da PDF/immagine) → toast "Formato non supportato".
- File > 10 MB → toast "File troppo grande (max 10 MB)".
- Errore di upload o di creazione signed URL → toast con messaggio d'errore.
- L'eliminazione del vecchio file in storage è best-effort: un errore non blocca
  il flusso (il file orfano è tollerato).

## Testing
La feature è UI + storage, difficile da coprire con unit test. Si testa
manualmente sul deploy:
1. Crea/modifica una spesa, carica un PDF → compare nome + Apri/Rimuovi.
2. Salva, riapri in modifica → l'allegato è ancora presente.
3. Nella lista spese compare la graffetta; cliccandola si apre il file.
4. Rimuovi l'allegato e salva → la graffetta sparisce.
5. Sostituisci un allegato con un altro file → si apre il nuovo.

Le due funzioni helper pure e testabili sono il derivatore del nome
visualizzato e (eventualmente) il costruttore del path: si può aggiungere un
piccolo unit test per `displayNameFromPath` se collocato in un util.

## Note sicurezza (non in scope, da rivedere dopo)
Il bucket `documents` è pubblico con policy che consentono a `anon` di caricare
e leggere qualsiasi file. Per la Fase 1 non si modifica, ma è un rischio noto:
in futuro andrebbero ristrette le policy (es. solo utenti autenticati, path per
utente) e valutato un bucket privato con accesso solo via signed URL.
