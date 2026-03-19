-- FASE 1: Stripe + Email + iCal - Schema Migration
-- Eseguire su Supabase Dashboard -> SQL Editor

-- 1. Nuova tabella payment_settings
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  stripe_account_id TEXT,
  stripe_configured BOOLEAN DEFAULT false,
  caparra_percentage INTEGER DEFAULT 30,
  caparra_due_days INTEGER DEFAULT 0,
  saldo_due_days_before INTEGER DEFAULT 7,
  cauzione_amount DECIMAL(10,2) DEFAULT 200,
  cauzione_preauth_days_before INTEGER DEFAULT 3,
  cauzione_release_days_after INTEGER DEFAULT 7,
  tassa_soggiorno_per_night DECIMAL(10,2) DEFAULT 0,
  tassa_soggiorno_per_person BOOLEAN DEFAULT true,
  checkin_email_days_before INTEGER DEFAULT 3,
  reminder_days_before INTEGER DEFAULT 2,
  brand_logo_url TEXT,
  brand_color TEXT DEFAULT '#0f172a',
  email_from_name TEXT,
  email_reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ALTER tenant_payments (Stripe columns)
ALTER TABLE public.tenant_payments
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_type TEXT,
  ADD COLUMN IF NOT EXISTS is_preauth BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preauth_released BOOLEAN,
  ADD COLUMN IF NOT EXISTS preauth_captured_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;

-- 3. ALTER bookings (tracking)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS numero_ospiti INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payment_schedule_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_uid TEXT;

-- 4. Nuova tabella email_log
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

-- 5. Nuova tabella ical_sync_log
CREATE TABLE IF NOT EXISTS public.ical_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  events_found INTEGER DEFAULT 0,
  bookings_created INTEGER DEFAULT 0,
  errors TEXT
);

-- 6. Aggiungere ical_url a properties_real (se non esiste)
ALTER TABLE public.properties_real
  ADD COLUMN IF NOT EXISTS ical_url TEXT;

-- RLS: disabled (coerente con force_open.sql)
ALTER TABLE public.payment_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ical_sync_log DISABLE ROW LEVEL SECURITY;
