-- IBAN opzionale sui conti (mostrato sulla card Cassa, con copia)
alter table public.conti add column if not exists iban text;
