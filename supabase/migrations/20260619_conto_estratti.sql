-- Archivio estratti conto per conto (file PDF/immagine mensili)
create table if not exists public.conto_estratti (
  id uuid primary key default gen_random_uuid(),
  conto_id uuid not null references public.conti(id) on delete cascade,
  user_id uuid,
  filename text not null,
  path text not null,
  anno int not null,
  mese int,
  created_at timestamptz default now()
);

alter table public.conto_estratti enable row level security;

create policy "conto_estratti all" on public.conto_estratti
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists conto_estratti_conto_idx on public.conto_estratti(conto_id);
