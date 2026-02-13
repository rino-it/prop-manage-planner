-- 1. GESTIONE PRENOTAZIONI & CONTRATTI
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  tipo_affitto TEXT CHECK (tipo_affitto IN ('breve', 'lungo')),
  
  -- Dati Ospite
  nome_ospite TEXT NOT NULL,
  email_ospite TEXT,
  telefono_ospite TEXT,
  
  -- Date
  data_inizio DATE NOT NULL,
  data_fine DATE NOT NULL,
  checkin_status TEXT DEFAULT 'pending' CHECK (checkin_status IN ('pending', 'effettuato', 'checkout_fatto')),
  
  -- CORREZIONE: Aggiunta colonna updated_at
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. TICKET ASSISTENZA
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  stato TEXT DEFAULT 'aperto' CHECK (stato IN ('aperto', 'in_lavorazione', 'risolto')),
  priorita TEXT DEFAULT 'media',
  foto_url TEXT,
  
  -- CORREZIONE: Aggiunta colonna updated_at
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. MARKETPLACE & SERVIZI
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  prezzo DECIMAL(10,2),
  link_prenotazione TEXT,
  immagine_url TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Richieste servizi
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  service_id UUID REFERENCES public.services(id),
  stato TEXT DEFAULT 'richiesto' CHECK (stato IN ('richiesto', 'confermato', 'rifiutato')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. VOUCHER
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  codice TEXT NOT NULL,
  valore DECIMAL(10,2),
  descrizione TEXT,
  usato BOOLEAN DEFAULT false
);

-- 5. GESTIONE LUNGO TERMINE
CREATE TABLE IF NOT EXISTS public.tenant_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  tipo TEXT CHECK (tipo IN ('affitto', 'bolletta_luce', 'bolletta_gas', 'internet', 'condominio', 'altro')),
  importo DECIMAL(10,2) NOT NULL,
  data_scadenza DATE NOT NULL,
  stato TEXT DEFAULT 'da_pagare' CHECK (stato IN ('da_pagare', 'pagato', 'scaduto')),
  consumo_kw_mc DECIMAL(10,2),
  periodo_riferimento TEXT,
  documento_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SICUREZZA (RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Manager access bookings" ON bookings FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager access tickets" ON tickets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager access services" ON services FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager access requests" ON service_requests FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager access vouchers" ON vouchers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager access payments" ON tenant_payments FOR ALL USING (auth.uid() IS NOT NULL);

-- TRIGGERS (Ora funzioneranno perché le colonne esistono)
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();