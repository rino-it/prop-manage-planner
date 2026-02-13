-- Fix security issues from previous migration

-- Drop and recreate property_performance view without SECURITY DEFINER
DROP VIEW IF EXISTS public.property_performance;

CREATE VIEW public.property_performance AS
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
    AND user_id = auth.uid()  -- Add RLS enforcement
  GROUP BY property_real_id
) yearly_income ON pr.id = yearly_income.property_real_id
LEFT JOIN (
  SELECT 
    property_real_id,
    SUM(importo) as total_expenses
  FROM public.payments 
  WHERE scadenza >= CURRENT_DATE - INTERVAL '12 months'
    AND stato = 'pagato'
    AND user_id = auth.uid()  -- Add RLS enforcement
  GROUP BY property_real_id
) yearly_expenses ON pr.id = yearly_expenses.property_real_id
WHERE pr.user_id = auth.uid();  -- Enforce RLS on main table

-- Fix generate_property_code function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_property_code(property_type TEXT, user_id UUID)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT codice_identificativo FROM public.properties_real WHERE properties_real.user_id = generate_property_code.user_id
    UNION ALL
    SELECT codice_identificativo FROM public.properties_mobile WHERE properties_mobile.user_id = generate_property_code.user_id
  ) combined_properties
  WHERE codice_identificativo ~ ('^' || prefix || '\d+$');
  
  -- Format with leading zeros
  new_code := prefix || LPAD(counter::TEXT, 3, '0');
  
  RETURN new_code;
END;
$$;

-- Fix update_updated_at_column function with proper search_path  
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;