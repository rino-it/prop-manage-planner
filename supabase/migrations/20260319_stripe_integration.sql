-- =============================================================
-- Stripe Integration: payment_settings + tenant_payments columns
-- =============================================================

-- 1. Creare tabella payment_settings
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties_real(id) ON DELETE CASCADE,
  caparra_percentage NUMERIC(5,2) DEFAULT 30.00,
  caparra_due_days INTEGER DEFAULT 7,
  saldo_due_days_before INTEGER DEFAULT 14,
  cauzione_amount NUMERIC(10,2) DEFAULT 500.00,
  cauzione_preauth_days_before INTEGER DEFAULT 7,
  tassa_per_night NUMERIC(10,2) DEFAULT 3.00,
  tassa_per_person BOOLEAN DEFAULT true,
  stripe_configured BOOLEAN DEFAULT false,
  stripe_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(property_id)
);

-- 2. Aggiungere colonne a tenant_payments per Stripe
ALTER TABLE public.tenant_payments
  ADD COLUMN IF NOT EXISTS is_preauth BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS preauth_released BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preauth_captured_amount NUMERIC(10,2);

-- 3. Aggiungere colonna a bookings per tracking del payment schedule
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_schedule_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS importo_totale NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS numero_ospiti INTEGER DEFAULT 1;

-- 4. Aggiornare CHECK constraint su tenant_payments per i nuovi stati
ALTER TABLE public.tenant_payments
  DROP CONSTRAINT IF EXISTS tenant_payments_stato_check;

ALTER TABLE public.tenant_payments
  ADD CONSTRAINT tenant_payments_stato_check
  CHECK (stato IN ('da_pagare', 'pagato', 'scaduto', 'pre_autorizzato', 'rilasciato', 'rimborsato'));

-- 5. RLS: disabilitare RLS su payment_settings (configurazione amministrativa)
ALTER TABLE public.payment_settings DISABLE ROW LEVEL SECURITY;

-- 6. Indici per performance
CREATE INDEX IF NOT EXISTS idx_tenant_payments_stripe_session
  ON public.tenant_payments(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payments_stripe_intent
  ON public.tenant_payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_settings_property
  ON public.payment_settings(property_id);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_schedule
  ON public.bookings(payment_schedule_generated);
