-- Campi per il portale inquilini lungo termine
ALTER TABLE public.properties_real
  ADD COLUMN IF NOT EXISTS differenziata_info TEXT,
  ADD COLUMN IF NOT EXISTS contatti_utili TEXT;

-- Collega spese al booking inquilino e flag visibilità
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS visible_tenant BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_booking
  ON public.payments(tenant_booking_id)
  WHERE tenant_booking_id IS NOT NULL;
