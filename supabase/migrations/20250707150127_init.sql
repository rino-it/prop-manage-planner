-- Create enum types
CREATE TYPE public.property_type AS ENUM ('appartamento', 'casa', 'ufficio', 'magazzino');
CREATE TYPE public.property_status AS ENUM ('ottimo', 'buono', 'discreto', 'da_ristrutturare');
CREATE TYPE public.mobile_category AS ENUM ('veicolo', 'imbarcazione', 'attrezzatura');
CREATE TYPE public.fuel_type AS ENUM ('benzina', 'diesel', 'gpl', 'metano', 'elettrico');
CREATE TYPE public.activity_type AS ENUM ('manutenzione', 'pulizia', 'ispezione', 'generale');
CREATE TYPE public.recurrence_type AS ENUM ('giornaliera', 'settimanale', 'mensile', 'trimestrale', 'semestrale', 'annuale', 'personalizzata');
CREATE TYPE public.priority_level AS ENUM ('alta', 'media', 'bassa');
CREATE TYPE public.payment_status AS ENUM ('in_attesa', 'pagato', 'scaduto', 'parzialmente_pagato');
CREATE TYPE public.payment_category AS ENUM ('condominio', 'tasse', 'assicurazione', 'bollo', 'manutenzione', 'altro');
CREATE TYPE public.payment_recurrence AS ENUM ('mensile', 'trimestrale', 'semestrale', 'annuale');
CREATE TYPE public.document_type AS ENUM ('contratto', 'assicurazione', 'certificato', 'fattura', 'libretto', 'altro');
CREATE TYPE public.maintenance_type AS ENUM ('tagliando', 'revisione', 'riparazione', 'sostituzione_parti');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create properties_real table (immobili)
CREATE TABLE public.properties_real (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  via TEXT NOT NULL,
  citta TEXT NOT NULL,
  cap TEXT NOT NULL,
  provincia TEXT NOT NULL,
  tipo property_type NOT NULL,
  metri_quadrati INTEGER,
  numero_vani INTEGER,
  anno_costruzione INTEGER,
  stato_conservazione property_status DEFAULT 'buono',
  valore_acquisto DECIMAL(12,2),
  valore_catastale DECIMAL(12,2),
  rendita DECIMAL(12,2),
  costi_gestione_annuali DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create properties_mobile table (beni mobili)
CREATE TABLE public.properties_mobile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria mobile_category NOT NULL,
  marca TEXT,
  modello TEXT,
  anno INTEGER,
  targa TEXT,
  numero_telaio TEXT,
  chilometraggio INTEGER,
  numero_immatricolazione TEXT,
  numero_serie TEXT,
  porto_stazionamento TEXT,
  valore_acquisto DECIMAL(12,2),
  valore_attuale DECIMAL(12,2),
  costi_manutenzione_annuali DECIMAL(12,2),
  consumo_medio DECIMAL(8,2),
  costo_per_km DECIMAL(8,4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_real_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE,
  property_mobile_id UUID REFERENCES public.properties_mobile(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descrizione TEXT,
  tipo activity_type NOT NULL DEFAULT 'generale',
  ricorrenza_tipo recurrence_type NOT NULL DEFAULT 'mensile',
  ricorrenza_intervallo INTEGER DEFAULT 1,
  giorno_specifico INTEGER,
  mese_specifico INTEGER,
  prossima_scadenza TIMESTAMP WITH TIME ZONE NOT NULL,
  ultima_esecuzione TIMESTAMP WITH TIME ZONE,
  costo DECIMAL(10,2) DEFAULT 0,
  fornitore TEXT,
  priorita priority_level DEFAULT 'media',
  completata BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT activities_property_check CHECK (
    (property_real_id IS NOT NULL AND property_mobile_id IS NULL) OR
    (property_real_id IS NULL AND property_mobile_id IS NOT NULL)
  )
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_real_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE,
  property_mobile_id UUID REFERENCES public.properties_mobile(id) ON DELETE CASCADE,
  descrizione TEXT NOT NULL,
  importo DECIMAL(10,2) NOT NULL,
  importo_originale DECIMAL(10,2) NOT NULL,
  scadenza TIMESTAMP WITH TIME ZONE NOT NULL,
  ricorrenza_tipo payment_recurrence NOT NULL DEFAULT 'mensile',
  escalation_attiva BOOLEAN DEFAULT false,
  escalation_percentuale DECIMAL(5,2) DEFAULT 0,
  escalation_applica_ogni_anno BOOLEAN DEFAULT true,
  stato payment_status DEFAULT 'in_attesa',
  fornitore TEXT,
  categoria payment_category DEFAULT 'altro',
  metodo_pagamento TEXT,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payments_property_check CHECK (
    (property_real_id IS NOT NULL AND property_mobile_id IS NULL) OR
    (property_real_id IS NULL AND property_mobile_id IS NOT NULL)
  )
);

-- Create payment_history table
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  importo_pagato DECIMAL(10,2) NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metodo_pagamento TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_real_id UUID REFERENCES public.properties_real(id) ON DELETE CASCADE,
  property_mobile_id UUID REFERENCES public.properties_mobile(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo document_type NOT NULL DEFAULT 'altro',
  url TEXT,
  dimensione BIGINT,
  formato TEXT,
  data_caricamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_scadenza TIMESTAMP WITH TIME ZONE,
  alert_scadenza_attivo BOOLEAN DEFAULT false,
  alert_giorni_prima INTEGER DEFAULT 30,
  ultimo_alert TIMESTAMP WITH TIME ZONE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT documents_property_check CHECK (
    (property_real_id IS NOT NULL AND property_mobile_id IS NULL) OR
    (property_real_id IS NULL AND property_mobile_id IS NOT NULL) OR
    (property_real_id IS NULL AND property_mobile_id IS NULL)
  )
);

-- Create refueling table for vehicles
CREATE TABLE public.refueling (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_mobile_id UUID NOT NULL REFERENCES public.properties_mobile(id) ON DELETE CASCADE,
  data_rifornimento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  litri DECIMAL(8,3) NOT NULL,
  costo_totale DECIMAL(8,2) NOT NULL,
  costo_per_litro DECIMAL(6,3) NOT NULL,
  chilometraggio INTEGER,
  tipo_carburante fuel_type NOT NULL DEFAULT 'benzina',
  stazione_servizio TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance table for vehicles
CREATE TABLE public.maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_mobile_id UUID NOT NULL REFERENCES public.properties_mobile(id) ON DELETE CASCADE,
  data_manutenzione TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tipo maintenance_type NOT NULL,
  costo DECIMAL(10,2) NOT NULL,
  chilometraggio INTEGER,
  descrizione TEXT NOT NULL,
  officina TEXT,
  prossima_manutenzione TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties_real ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties_mobile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refueling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for properties_real
CREATE POLICY "Users can view their own real properties" ON public.properties_real
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own real properties" ON public.properties_real
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own real properties" ON public.properties_real
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own real properties" ON public.properties_real
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for properties_mobile
CREATE POLICY "Users can view their own mobile properties" ON public.properties_mobile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mobile properties" ON public.properties_mobile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mobile properties" ON public.properties_mobile
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mobile properties" ON public.properties_mobile
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for activities
CREATE POLICY "Users can view their own activities" ON public.activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities" ON public.activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" ON public.activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities" ON public.activities
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for payments
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments" ON public.payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments" ON public.payments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for payment_history
CREATE POLICY "Users can view their own payment history" ON public.payment_history
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM public.payments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own payment history" ON public.payment_history
  FOR INSERT WITH CHECK (
    payment_id IN (
      SELECT id FROM public.payments WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for documents
CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for refueling
CREATE POLICY "Users can view their own refueling data" ON public.refueling
  FOR SELECT USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own refueling data" ON public.refueling
  FOR INSERT WITH CHECK (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own refueling data" ON public.refueling
  FOR UPDATE USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own refueling data" ON public.refueling
  FOR DELETE USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for maintenance
CREATE POLICY "Users can view their own maintenance data" ON public.maintenance
  FOR SELECT USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own maintenance data" ON public.maintenance
  FOR INSERT WITH CHECK (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own maintenance data" ON public.maintenance
  FOR UPDATE USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own maintenance data" ON public.maintenance
  FOR DELETE USING (
    property_mobile_id IN (
      SELECT id FROM public.properties_mobile WHERE user_id = auth.uid()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_real_updated_at
  BEFORE UPDATE ON public.properties_real
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_mobile_updated_at
  BEFORE UPDATE ON public.properties_mobile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_properties_real_user_id ON public.properties_real(user_id);
CREATE INDEX idx_properties_mobile_user_id ON public.properties_mobile(user_id);
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_prossima_scadenza ON public.activities(prossima_scadenza);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_scadenza ON public.payments(scadenza);
CREATE INDEX idx_payments_stato ON public.payments(stato);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_data_scadenza ON public.documents(data_scadenza);
CREATE INDEX idx_refueling_property_mobile_id ON public.refueling(property_mobile_id);
CREATE INDEX idx_maintenance_property_mobile_id ON public.maintenance(property_mobile_id);