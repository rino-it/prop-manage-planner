-- STEP 2: WhatsApp Bot + AI Ticket Integration
-- Aggiunge campi per tracciare ticket creati via WhatsApp e analisi AI

-- 1. Colonne aggiuntive su tickets per WhatsApp + AI
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'whatsapp', 'portal', 'email')),
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_from TEXT,
  ADD COLUMN IF NOT EXISTS ai_categoria TEXT,
  ADD COLUMN IF NOT EXISTS ai_priorita TEXT,
  ADD COLUMN IF NOT EXISTS ai_suggerimento TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS property_real_id UUID REFERENCES public.properties_real(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_mobile_id UUID REFERENCES public.properties_mobile(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scadenza TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allegati TEXT[] DEFAULT '{}';

-- 2. Tabella log messaggi WhatsApp (per tracciabilita e debug)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  wa_message_id TEXT UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT,
  body TEXT,
  media_url TEXT,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabella configurazione WhatsApp (per multi-proprietario futuro)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  webhook_secret TEXT,
  owner_whatsapp TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Aggiungere campo whatsapp_phone a bookings (per lookup inquilino)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- 5. Indici per performance
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source);
CREATE INDEX IF NOT EXISTS idx_tickets_whatsapp_from ON public.tickets(whatsapp_from);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from ON public.whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_bookings_whatsapp_phone ON public.bookings(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_telefono_ospite ON public.bookings(telefono_ospite);

-- 6. RLS: disabilitare per whatsapp_messages e whatsapp_config
--    (accesso solo via Edge Functions con service_role key)
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config DISABLE ROW LEVEL SECURITY;

-- 7. Trigger updated_at per whatsapp_config
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
