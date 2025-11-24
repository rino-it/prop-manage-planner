-- 1. CAMPI PER GUEST EXPERIENCE & ICAL (Proprietà)
ALTER TABLE public.properties_real 
ADD COLUMN IF NOT EXISTS ical_url TEXT, -- Per sincronizzare calendari
ADD COLUMN IF NOT EXISTS wifi_ssid TEXT, -- Nome WiFi
ADD COLUMN IF NOT EXISTS wifi_password TEXT, -- Password WiFi
ADD COLUMN IF NOT EXISTS istruzioni_checkin TEXT, -- Testo o Link Video
ADD COLUMN IF NOT EXISTS codice_keybox TEXT; -- Codice cassetta chiavi

-- 2. CAMPO LINK PAGAMENTO (Servizi)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS payment_link TEXT; -- Link Stripe/PayPal

-- 3. GESTIONE DOCUMENTI OSPITI (Prenotazioni)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS documenti_url TEXT, -- Link al file caricato
ADD COLUMN IF NOT EXISTS documenti_caricati BOOLEAN DEFAULT false;

-- 4. TOKEN STAFF (Per le pulizie)
ALTER TABLE public.properties_real
ADD COLUMN IF NOT EXISTS staff_token UUID DEFAULT gen_random_uuid();