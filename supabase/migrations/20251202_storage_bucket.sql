-- 1. Crea il Bucket "documents" (pubblico per semplicità MVP)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: CHIUNQUE (Ospite) può caricare file nel bucket 'documents'
CREATE POLICY "Guest Upload Policy" 
ON storage.objects FOR INSERT 
TO anon 
WITH CHECK (bucket_id = 'documents');

-- 3. Policy: CHIUNQUE può vedere i file (perché servono al manager)
CREATE POLICY "Public Read Policy" 
ON storage.objects FOR SELECT 
TO anon 
USING (bucket_id = 'documents');