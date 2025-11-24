-- Aggiungiamo lo stato dei documenti
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stato_documenti TEXT DEFAULT 'mancante' 
CHECK (stato_documenti IN ('mancante', 'in_revisione', 'approvato', 'rifiutato'));

-- Migriamo i dati vecchi (chi ha già caricato è approvato d'ufficio per ora)
UPDATE public.bookings 
SET stato_documenti = 'approvato' 
WHERE documenti_caricati = true;