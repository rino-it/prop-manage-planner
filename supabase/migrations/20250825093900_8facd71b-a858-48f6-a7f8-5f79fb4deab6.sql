-- Add critical fields for comprehensive property management

-- Enhance properties_real table with property management essentials
ALTER TABLE public.properties_real 
ADD COLUMN IF NOT EXISTS codice_identificativo TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stato TEXT DEFAULT 'uso_personale' CHECK (stato IN ('uso_personale', 'affitto', 'ristrutturazione', 'vendita')),
ADD COLUMN IF NOT EXISTS proprietario_legale TEXT,
ADD COLUMN IF NOT EXISTS quota_possesso NUMERIC DEFAULT 100 CHECK (quota_possesso > 0 AND quota_possesso <= 100),
ADD COLUMN IF NOT EXISTS canone_mensile NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_inizio_contratto DATE,
ADD COLUMN IF NOT EXISTS data_fine_contratto DATE,
ADD COLUMN IF NOT EXISTS inquilino TEXT,
ADD COLUMN IF NOT EXISTS contatto_inquilino TEXT;

-- Enhance properties_mobile table with management fields  
ALTER TABLE public.properties_mobile
ADD COLUMN IF NOT EXISTS codice_identificativo TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stato TEXT DEFAULT 'uso_personale' CHECK (stato IN ('uso_personale', 'affitto', 'vendita', 'manutenzione')),
ADD COLUMN IF NOT EXISTS proprietario_legale TEXT,
ADD COLUMN IF NOT EXISTS quota_possesso NUMERIC DEFAULT 100 CHECK (quota_possesso > 0 AND quota_possesso <= 100);

-- Create income tracking table for rental revenues
CREATE TABLE IF NOT EXISTS public.income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_real_id UUID REFERENCES public.properties_real(id),
  property_mobile_id UUID REFERENCES public.properties_mobile(id),
  tipo_entrata TEXT NOT NULL DEFAULT 'affitto' CHECK (tipo_entrata IN ('affitto', 'rimborso_spese', 'plusvalenza', 'altro')),
  importo NUMERIC NOT NULL,
  data_incasso DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_riferimento DATE, -- for monthly rent tracking
  descrizione TEXT NOT NULL,
  inquilino TEXT,
  stato TEXT DEFAULT 'incassato' CHECK (stato IN ('incassato', 'in_attesa', 'parziale')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT income_property_check CHECK (
    (property_real_id IS NOT NULL AND property_mobile_id IS NULL) OR
    (property_real_id IS NULL AND property_mobile_id IS NOT NULL)
  )
);

-- Enable RLS for income table
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- Create policies for income table
CREATE POLICY "Users can view their own income" 
ON public.income 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own income" 
ON public.income 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own income" 
ON public.income 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own income" 
ON public.income 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create property performance view for ROI calculations
CREATE OR REPLACE VIEW public.property_performance AS
SELECT 
  pr.id,
  pr.codice_identificativo,
  pr.nome,
  pr.stato,
  pr.valore_acquisto,
  pr.canone_mensile,
  COALESCE(yearly_income.total_income, 0) as reddito_annuale,
  COALESCE(yearly_expenses.total_expenses, 0) as spese_annuali,
  COALESCE(yearly_income.total_income, 0) - COALESCE(yearly_expenses.total_expenses, 0) as reddito_netto_annuale,
  CASE 
    WHEN pr.valore_acquisto > 0 AND pr.valore_acquisto IS NOT NULL THEN
      ((COALESCE(yearly_income.total_income, 0) - COALESCE(yearly_expenses.total_expenses, 0)) / pr.valore_acquisto) * 100
    ELSE 0
  END as roi_percentuale,
  CASE 
    WHEN pr.canone_mensile > 0 THEN pr.canone_mensile * 12
    ELSE 0
  END as reddito_teorico_annuale
FROM public.properties_real pr
LEFT JOIN (
  SELECT 
    property_real_id,
    SUM(importo) as total_income
  FROM public.income 
  WHERE data_incasso >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY property_real_id
) yearly_income ON pr.id = yearly_income.property_real_id
LEFT JOIN (
  SELECT 
    property_real_id,
    SUM(importo) as total_expenses
  FROM public.payments 
  WHERE scadenza >= CURRENT_DATE - INTERVAL '12 months'
    AND stato = 'pagato'
  GROUP BY property_real_id
) yearly_expenses ON pr.id = yearly_expenses.property_real_id;

-- Create notifications table with intelligent reminders
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('scadenza_pagamento', 'scadenza_contratto', 'manutenzione_programmata', 'rinnovo_documento', 'promemoria_generale')),
  titolo TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  data_scadenza DATE NOT NULL,
  giorni_preavviso INTEGER DEFAULT 15,
  inviata BOOLEAN DEFAULT FALSE,
  data_invio TIMESTAMP WITH TIME ZONE,
  priorita TEXT DEFAULT 'media' CHECK (priorita IN ('bassa', 'media', 'alta', 'critica')),
  property_real_id UUID REFERENCES public.properties_real(id),
  property_mobile_id UUID REFERENCES public.properties_mobile(id),
  payment_id UUID REFERENCES public.payments(id),
  activity_id UUID REFERENCES public.activities(id),
  document_id UUID REFERENCES public.documents(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to auto-generate property codes
CREATE OR REPLACE FUNCTION generate_property_code(property_type TEXT, user_id UUID)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  counter INTEGER;
  new_code TEXT;
BEGIN
  -- Set prefix based on property type
  prefix := CASE 
    WHEN property_type = 'real' THEN 'PV'
    WHEN property_type = 'mobile' THEN 'PM'
    ELSE 'PR'
  END;
  
  -- Get next counter for this user and type
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(codice_identificativo FROM '^' || prefix || '(\d+)$') AS INTEGER)
  ), 0) + 1 INTO counter
  FROM (
    SELECT codice_identificativo FROM properties_real WHERE properties_real.user_id = generate_property_code.user_id
    UNION ALL
    SELECT codice_identificativo FROM properties_mobile WHERE properties_mobile.user_id = generate_property_code.user_id
  ) combined_properties
  WHERE codice_identificativo ~ ('^' || prefix || '\d+$');
  
  -- Format with leading zeros
  new_code := prefix || LPAD(counter::TEXT, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at for income table
CREATE TRIGGER update_income_updated_at
  BEFORE UPDATE ON public.income
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();