-- Step 3: AI Features - Triage, Digest, Document Analysis
-- Data: 2026-03-24

-- 1. Tabella log per i digest giornalieri AI
CREATE TABLE IF NOT EXISTS ai_digest_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  digest_text text NOT NULL,
  payments_count integer DEFAULT 0,
  tickets_count integer DEFAULT 0,
  bookings_count integer DEFAULT 0,
  documents_count integer DEFAULT 0,
  sent_email boolean DEFAULT false,
  sent_whatsapp boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS disabilitata: solo service role accede a questa tabella
ALTER TABLE ai_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_digest_log"
  ON ai_digest_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Colonne AI per analisi documenti nella tabella booking_documents
-- (se la tabella esiste gia, aggiungiamo le colonne)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_documents') THEN
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_doc_type text;
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_extracted_name text;
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_extracted_cf text;
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_doc_expiry date;
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_doc_number text;
    ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;
  END IF;
END
$$;

-- 3. Indici per performance query digest
CREATE INDEX IF NOT EXISTS idx_tenant_payments_scadenza_stato
  ON tenant_payments (data_scadenza, stato)
  WHERE stato NOT IN ('pagato', 'rimborsato');

CREATE INDEX IF NOT EXISTS idx_tickets_stato_created
  ON tickets (stato, created_at)
  WHERE stato IN ('aperto', 'in_attesa');

CREATE INDEX IF NOT EXISTS idx_bookings_checkin_docs
  ON bookings (data_inizio, documents_approved)
  WHERE documents_approved = false;

-- 4. Aggiungere template_type 'digest' ai valori accettati in email_log (se ha un check constraint)
-- Non c'e un enum, email_log.template_type e text libero, quindi nessuna modifica necessaria.
