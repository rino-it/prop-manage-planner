-- Collaboratori (keyholder / addetti pulizie) e condizioni di compenso.
CREATE TABLE IF NOT EXISTS public.collaboratori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nome text NOT NULL,
  telefono text,
  note text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collaboratori_condizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboratore_id uuid NOT NULL REFERENCES public.collaboratori(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties_real(id) ON DELETE CASCADE, -- NULL solo per tipo='mensile'
  tipo text NOT NULL CHECK (tipo IN ('checkin','pulizia','mensile')),
  importo numeric(10,2) NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.collaboratori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboratori_condizioni ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated full access" ON public.collaboratori;
CREATE POLICY "authenticated full access" ON public.collaboratori
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated full access" ON public.collaboratori_condizioni;
CREATE POLICY "authenticated full access" ON public.collaboratori_condizioni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS collaboratore_id uuid REFERENCES public.collaboratori(id),
  ADD COLUMN IF NOT EXISTS source_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_collaboratore ON public.payments(collaboratore_id);

-- Trigger: alla creazione di una prenotazione genera i compensi checkin/pulizia.
CREATE OR REPLACE FUNCTION public.genera_compensi_collaboratori()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.payments
    (importo, importo_originale, descrizione, categoria, scadenza, stato, competence,
     user_id, property_real_id, collaboratore_id, source_booking_id, payment_method)
  SELECT c.importo, c.importo,
         'Compenso ' || col.nome || ' — ' ||
           CASE c.tipo WHEN 'checkin' THEN 'check-in' ELSE 'pulizia' END ||
           ' ' || COALESCE(NULLIF(TRIM(NEW.nome_ospite), ''), 'prenotazione'),
         'altro',
         CASE c.tipo WHEN 'checkin' THEN NEW.data_inizio ELSE COALESCE(NEW.data_fine, NEW.data_inizio) END,
         'da_pagare', 'owner',
         NEW.user_id, NEW.property_id, c.collaboratore_id, NEW.id, 'contanti'
  FROM public.collaboratori_condizioni c
  JOIN public.collaboratori col ON col.id = c.collaboratore_id
  WHERE c.property_id = NEW.property_id AND c.attivo AND col.attivo
    AND c.tipo IN ('checkin','pulizia');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_genera_compensi ON public.bookings;
CREATE TRIGGER trg_genera_compensi AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.genera_compensi_collaboratori();

-- Trigger: alla cancellazione della prenotazione rimuove i compensi non ancora pagati.
CREATE OR REPLACE FUNCTION public.pulisci_compensi_collaboratori()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.payments
   WHERE source_booking_id = OLD.id AND collaboratore_id IS NOT NULL AND stato = 'da_pagare';
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pulisci_compensi ON public.bookings;
CREATE TRIGGER trg_pulisci_compensi BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.pulisci_compensi_collaboratori();
