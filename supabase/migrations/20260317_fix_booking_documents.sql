-- =============================================================
-- FIX: Tabella booking_documents + RLS per accesso anonimo
-- =============================================================

-- 1. CREA TABELLA booking_documents (se non esiste già)
CREATE TABLE IF NOT EXISTS public.booking_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'in_revisione' CHECK (status IN ('in_revisione', 'approvato', 'rifiutato')),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. AGGIUNGI colonna documents_approved a bookings (se non esiste)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS documents_approved BOOLEAN DEFAULT false;

-- 3. RLS: Disabilita su booking_documents (come già fatto per bookings e tickets)
--    Gli ospiti devono poter inserire e leggere i propri documenti senza login
ALTER TABLE public.booking_documents DISABLE ROW LEVEL SECURITY;

-- 4. POLICY per tenant_payments: gli ospiti anonimi devono poter leggere i pagamenti
--    (la policy esistente "Manager access payments" richiede auth.uid() IS NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_payments' AND policyname = 'Public read tenant payments'
  ) THEN
    CREATE POLICY "Public read tenant payments"
    ON public.tenant_payments
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- 5. POLICY per tickets: gli ospiti anonimi devono poter leggere i propri ticket
--    (tickets ha RLS disabilitato, ma aggiungiamo per sicurezza se viene riabilitato)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tickets' AND policyname = 'Public read tickets'
  ) THEN
    CREATE POLICY "Public read tickets"
    ON public.tickets
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;
