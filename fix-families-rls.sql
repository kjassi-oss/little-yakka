-- =====================================================================
-- SECURITY FIX — families cross-family read leak (2026-07-17)
-- =====================================================================
-- FOUND: any AUTHENTICATED user could read EVERY family's row via
--   supabase.from('families').select('*')  →  12 rows, not 1.
-- Exposed: family name (real surnames), settings JSON, bonus_* config.
-- (No child data — children/tasks/rewards/etc. are correctly scoped. The
-- anon key sees nothing; the leak needs a signed-in session, which is why the
-- earlier anon-only audit missed it.) A leftover permissive SELECT policy was
-- OR-ing past the correct guardian-scoped one.
--
-- WHY NOT JUST DROP THE PERMISSIVE POLICY: signup's createFamily() does
--   insert(...).select('id').single()
-- and PostgREST filters RETURNING through the SELECT policy. At insert time the
-- guardian row doesn't exist yet, so a purely guardian-scoped SELECT would hide
-- the just-created family and BREAK onboarding. So we add created_by (defaults
-- to the inserter) and let a user also read families they created.
--
-- Run this whole block once in the Supabase SQL editor. Idempotent.
-- =====================================================================

-- 1. Ownership column so the inserting user can read their brand-new family
--    back (RETURNING) before the guardian row exists. Existing rows stay NULL
--    and remain visible via the guardian link below.
alter table public.families add column if not exists created_by uuid default auth.uid();

alter table public.families enable row level security;

-- 2. Drop EVERY existing policy on families (names vary / one is permissive),
--    then recreate only the correctly-scoped set.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'families'
  loop
    execute format('drop policy %I on public.families', p.policyname);
  end loop;
end $$;

-- 3a. READ: only families you created OR belong to.
create policy "families_select" on public.families for select
  using (
    created_by = auth.uid()
    or id in (select family_id from public.guardians where auth_user_id = auth.uid())
  );

-- 3b. UPDATE: only your own family (guardian membership).
create policy "families_update" on public.families for update
  using (id in (select family_id from public.guardians where auth_user_id = auth.uid()))
  with check (id in (select family_id from public.guardians where auth_user_id = auth.uid()));

-- 3c. INSERT: any authenticated user (a family is created during signup BEFORE
--     the guardian row exists). created_by is filled by the column default.
create policy "families_insert" on public.families for insert
  with check (auth.uid() is not null);

-- 4. (optional, safe) backfill created_by for existing families from their
--    first guardian, so owners can read them via created_by too. Not required
--    for correctness — the guardian link already covers them.
update public.families f
set created_by = g.auth_user_id
from public.guardians g
where g.family_id = f.id
  and f.created_by is null
  and g.auth_user_id is not null;
