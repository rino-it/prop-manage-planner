-- Incassi liberi: un incasso può essere legato alla sola proprietà, senza booking.
ALTER TABLE public.tenant_payments
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties_real(id);

CREATE INDEX IF NOT EXISTS idx_tenant_payments_property_id
  ON public.tenant_payments(property_id);
