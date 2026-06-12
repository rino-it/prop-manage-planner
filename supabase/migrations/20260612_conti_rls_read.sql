drop policy if exists "conti all" on public.conti;
drop policy if exists "giroconti all" on public.giroconti;

create policy "conti select" on public.conti for select using (true);
create policy "conti write"  on public.conti for insert with check (auth.uid() = user_id);
create policy "conti update" on public.conti for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conti delete" on public.conti for delete using (auth.uid() = user_id);

create policy "giroconti select" on public.giroconti for select using (true);
create policy "giroconti write"  on public.giroconti for insert with check (auth.uid() = user_id);
create policy "giroconti update" on public.giroconti for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "giroconti delete" on public.giroconti for delete using (auth.uid() = user_id);
