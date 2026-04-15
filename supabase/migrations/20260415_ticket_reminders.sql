-- Aggiunge colonne per tracciare i promemoria WhatsApp già inviati
-- Previene duplicati se il cron gira più volte nello stesso giorno

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS reminder_day_before_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_day_of_sent BOOLEAN DEFAULT false;

-- Index per velocizzare la query del cron
CREATE INDEX IF NOT EXISTS idx_tickets_reminder_scadenza
  ON public.tickets(data_scadenza, stato)
  WHERE stato != 'risolto';
