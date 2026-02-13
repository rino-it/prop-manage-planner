-- 1. SBLOCCO STORAGE (Permetti upload file)
-- Rimuoviamo vecchie policy per sicurezza ed evitiamo conflitti
DROP POLICY IF EXISTS "Guest Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Guest Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Guest Select" ON storage.objects;

-- Nuova Policy: Chiunque può INSERIRE file nel bucket 'documents'
CREATE POLICY "Allow Guest Uploads"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documents');

-- Nuova Policy: Chiunque può LEGGERE file dal bucket 'documents'
CREATE POLICY "Allow Guest Select"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'documents');

-- 2. SBLOCCO TABELLA PRENOTAZIONI (Permetti aggiornamento stato check-in)
-- Rimuoviamo vecchie policy se esistono
DROP POLICY IF EXISTS "Guest Update Booking" ON public.bookings;

-- Nuova Policy: L'ospite (anon) può fare UPDATE sulla tabella bookings
-- (Serve per cambiare 'documenti_caricati' da false a true)
CREATE POLICY "Guest Update Booking"
ON public.bookings
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);