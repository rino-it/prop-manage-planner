-- Nuovi tipi di condizione compenso: check-out e biancheria (lenzuola/asciugamani).
-- Additiva e ri-eseguibile.

-- 1) Allarga il CHECK sui tipi ammessi.
ALTER TABLE public.collaboratori_condizioni
  DROP CONSTRAINT IF EXISTS collaboratori_condizioni_tipo_check;
ALTER TABLE public.collaboratori_condizioni
  ADD CONSTRAINT collaboratori_condizioni_tipo_check
  CHECK (tipo IN ('checkin','checkout','pulizia','lenzuola_matrimoniale','lenzuola_singolo','kit_asciugamani','mensile'));

-- 2) Trigger aggiornato: genera un compenso per prenotazione per ogni condizione
--    attiva, con data ed etichetta per tipo. 'mensile' resta lazy (non nel trigger).
CREATE OR REPLACE FUNCTION public.genera_compensi_collaboratori()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.payments
    (importo, importo_originale, descrizione, categoria, scadenza, stato, competence,
     user_id, property_real_id, collaboratore_id, source_booking_id, payment_method)
  SELECT c.importo, c.importo,
         'Compenso ' || col.nome || ' — ' ||
           CASE c.tipo
             WHEN 'checkin'                THEN 'check-in'
             WHEN 'checkout'               THEN 'check-out'
             WHEN 'pulizia'                THEN 'pulizia'
             WHEN 'lenzuola_matrimoniale'  THEN 'lenzuola matrimoniale'
             WHEN 'lenzuola_singolo'       THEN 'lenzuola singolo'
             WHEN 'kit_asciugamani'        THEN 'kit asciugamani'
             ELSE c.tipo
           END ||
           ' ' || COALESCE(NULLIF(TRIM(NEW.nome_ospite), ''), 'prenotazione'),
         'altro',
         -- Preparazione (arrivo) alla data_inizio; pulizia/check-out alla data_fine.
         CASE c.tipo
           WHEN 'checkout' THEN COALESCE(NEW.data_fine, NEW.data_inizio)
           WHEN 'pulizia'  THEN COALESCE(NEW.data_fine, NEW.data_inizio)
           ELSE NEW.data_inizio
         END,
         'da_pagare', 'owner',
         NEW.user_id, NEW.property_id, c.collaboratore_id, NEW.id, 'contanti'
  FROM public.collaboratori_condizioni c
  JOIN public.collaboratori col ON col.id = c.collaboratore_id
  WHERE c.property_id = NEW.property_id AND c.attivo AND col.attivo
    AND c.tipo IN ('checkin','checkout','pulizia','lenzuola_matrimoniale','lenzuola_singolo','kit_asciugamani');
  RETURN NEW;
END $$;
