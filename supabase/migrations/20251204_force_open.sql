-- 1. DISABILITA RLS (Row Level Security)
-- Questo elimina l'errore "violates row-level security policy" alla radice per i dati
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;

-- 2. SBLOCCO TOTALE STORAGE
-- Non si può disabilitare RLS su storage.objects, quindi creiamo una regola "TUTTO PERMESSO"
DROP POLICY IF EXISTS "Guest Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Guest Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Guest Select" ON storage.objects;

-- Permetti a CHIUNQUE (anonimi compresi) di fare TUTTO (Insert, Select, Update, Delete)
CREATE POLICY "Super Permissive Policy"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 3. ASSICURA ESISTENZA BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;