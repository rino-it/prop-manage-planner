-- Gestioni (2 gruppi fissi)
create table if not exists public.gestioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text,
  created_at timestamptz default now()
);

-- Conti / casse per gestione
create table if not exists public.conti (
  id uuid primary key default gen_random_uuid(),
  gestione_id uuid not null references public.gestioni(id) on delete cascade,
  nome text not null,
  tipo text not null default 'banca' check (tipo in ('contanti','banca')),
  saldo_iniziale numeric not null default 0,
  data_apertura date not null default current_date,
  user_id uuid,
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- Giroconti tra conti
create table if not exists public.giroconti (
  id uuid primary key default gen_random_uuid(),
  conto_from uuid not null references public.conti(id) on delete cascade,
  conto_to uuid not null references public.conti(id) on delete cascade,
  importo numeric not null,
  data date not null default current_date,
  descrizione text,
  user_id uuid,
  created_at timestamptz default now()
);

-- Colonne nuove
alter table public.properties_real    add column if not exists gestione_id uuid references public.gestioni(id);
alter table public.properties_mobile  add column if not exists gestione_id uuid references public.gestioni(id);
alter table public.payments           add column if not exists conto_id uuid references public.conti(id);
alter table public.tenant_payments    add column if not exists conto_id uuid references public.conti(id);

-- Seed 2 gestioni fisse (idempotente)
insert into public.gestioni (nome, colore)
select 'Io & Mamma', 'blue'
where not exists (select 1 from public.gestioni where nome = 'Io & Mamma');
insert into public.gestioni (nome, colore)
select 'Nonni', 'orange'
where not exists (select 1 from public.gestioni where nome = 'Nonni');

-- RLS coerente con le altre tabelle
alter table public.gestioni  enable row level security;
alter table public.conti     enable row level security;
alter table public.giroconti enable row level security;

create policy "gestioni read"  on public.gestioni  for select using (true);
create policy "conti all"      on public.conti      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "giroconti all"  on public.giroconti  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
