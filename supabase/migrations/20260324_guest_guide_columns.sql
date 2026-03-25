-- Step 3.1: Colonne aggiuntive per Guida Ospiti su properties_real
-- Alcune colonne (wifi_ssid, wifi_password, codice_keybox, istruzioni_checkin) esistono gia
-- dalla migration 20251201_upgrade_properties.sql.
-- Qui aggiungiamo le colonne mancanti per completare la sezione Guida Ospiti.

ALTER TABLE public.properties_real
  ADD COLUMN IF NOT EXISTS keybox_code TEXT,
  ADD COLUMN IF NOT EXISTS checkin_video_url TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS house_rules TEXT,
  ADD COLUMN IF NOT EXISTS checkin_instructions TEXT;

-- Se codice_keybox esiste ma keybox_code no, copiamo i dati
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties_real' AND column_name = 'codice_keybox'
  ) THEN
    UPDATE public.properties_real
    SET keybox_code = codice_keybox
    WHERE keybox_code IS NULL AND codice_keybox IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties_real' AND column_name = 'istruzioni_checkin'
  ) THEN
    UPDATE public.properties_real
    SET checkin_instructions = istruzioni_checkin
    WHERE checkin_instructions IS NULL AND istruzioni_checkin IS NOT NULL;
  END IF;
END
$$;
