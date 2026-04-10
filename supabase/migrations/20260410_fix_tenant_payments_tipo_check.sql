-- Fix: rimuove il constraint rigido su tenant_payments.tipo
-- e lo sostituisce con uno che include tutti i tipi del guest portal

ALTER TABLE public.tenant_payments
  DROP CONSTRAINT IF EXISTS tenant_payments_tipo_check;

ALTER TABLE public.tenant_payments
  ADD CONSTRAINT tenant_payments_tipo_check
  CHECK (tipo IN (
    -- Originali (affitti lunghi)
    'affitto',
    'bolletta_luce',
    'bolletta_gas',
    'internet',
    'condominio',
    -- Guest portal
    'caparra',
    'saldo',
    'cauzione',
    'tassa_soggiorno',
    'biancheria',
    'pulizie',
    'extra',
    'altro'
  ));
