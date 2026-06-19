-- Piani di rientro: rateizzazione debiti/crediti
create table if not exists public.piani_rientro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gestione_id uuid not null references public.gestioni(id) on delete cascade,
  fornitore text not null,
  direzione text not null default 'uscita' check (direzione in ('uscita','entrata')),
  importo_totale numeric not null,
  numero_rate int not null check (numero_rate between 2 and 60),
  frequenza text not null,
  data_prima_rata date not null,
  stato text not null default 'attivo' check (stato in ('attivo','completato','annullato')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists piano_rientro_id uuid references public.piani_rientro(id) on delete set null,
  add column if not exists rata_numero int,
  add column if not exists consolidato_in_piano_id uuid references public.piani_rientro(id) on delete set null;

create index if not exists idx_payments_piano_rientro on public.payments(piano_rientro_id);
create index if not exists idx_payments_consolidato on public.payments(consolidato_in_piano_id);

alter table public.piani_rientro enable row level security;

create policy "piani_rientro_select_own" on public.piani_rientro for select using (auth.uid() = user_id);
create policy "piani_rientro_insert_own" on public.piani_rientro for insert with check (auth.uid() = user_id);
create policy "piani_rientro_update_own" on public.piani_rientro for update using (auth.uid() = user_id);
create policy "piani_rientro_delete_own" on public.piani_rientro for delete using (auth.uid() = user_id);
