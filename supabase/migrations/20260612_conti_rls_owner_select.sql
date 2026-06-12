-- Security fix: cash data (conti/giroconti) must be readable only by the owner.
-- The previous `using (true)` SELECT policy exposed every user's accounts to any
-- authenticated user (IDOR / broken RLS). Scope reads to the owning user, matching
-- the write policies.

drop policy if exists "conti select"     on public.conti;
drop policy if exists "giroconti select" on public.giroconti;

create policy "conti select"     on public.conti     for select using (auth.uid() = user_id);
create policy "giroconti select" on public.giroconti for select using (auth.uid() = user_id);
