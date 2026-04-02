CREATE TABLE sync_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_batch_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES portal_connections(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties_real(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  external_uid text NOT NULL,
  portal_name text NOT NULL,
  source text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('booking', 'blocked')),
  change_type text NOT NULL CHECK (change_type IN ('new', 'updated', 'cancelled')),
  nome_ospite text,
  email_ospite text,
  telefono_ospite text,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  raw_summary text,
  numero_ospiti integer DEFAULT 1,
  tipo_affitto text DEFAULT 'breve',
  existing_booking_id uuid,
  previous_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'modified', 'rejected')),
  synced_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_staging_batch ON sync_staging(sync_batch_id);
CREATE INDEX idx_sync_staging_user_status ON sync_staging(user_id, status);
CREATE INDEX idx_sync_staging_connection ON sync_staging(connection_id);

ALTER TABLE sync_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own staging items"
  ON sync_staging FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own staging items"
  ON sync_staging FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage staging"
  ON sync_staging FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE sync_staging IS 'Staging area per revisione manuale dei sync dai portali prima della conferma in bookings';
