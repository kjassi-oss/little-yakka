-- =====================================================================
-- Little Yakka — Row Level Security (RLS) check & recommended policies
-- =====================================================================
-- WHY THIS MATTERS: the app talks to Supabase with the PUBLIC anon key
-- (shipped to every browser) and filters data in application code, e.g.
--   .eq('family_id', guardian.family_id)
-- That filtering is NOT security. If RLS is disabled, anyone can open the
-- network tab, grab your anon key + project URL, and query EVERY family's
-- children, photos, stars and messages directly. RLS is what actually
-- isolates one family's data from another.
--
-- HOW TO USE:
--   1. Run PART A + PART B (read-only) and share the output.
--   2. Do the two-account isolation test in PART C.
--   3. Only then apply PART D — carefully, one table at a time, testing the
--      app after each. Enabling RLS with a wrong/missing policy will make the
--      app return empty data until fixed. The admin + self-delete features use
--      the SERVICE ROLE key and bypass RLS, so they keep working regardless.
-- =====================================================================


-- ============ PART A — is RLS enabled on each table? ============
-- Expect rls_enabled = true for EVERY app table. Any 'false' is a hole.
select c.relname                as table_name,
       c.relrowsecurity         as rls_enabled,
       c.relforcerowsecurity    as rls_forced
from   pg_class c
join   pg_namespace n on n.oid = c.relnamespace
where  n.nspname = 'public'
  and  c.relkind = 'r'
order  by c.relname;


-- ============ PART B — list every policy that exists ============
-- Empty result for a table that has RLS enabled = that table is fully locked
-- (app can't read it). RLS enabled WITH sensible policies = correct.
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from   pg_policies
where  schemaname = 'public'
order  by tablename, policyname;


-- ============ PART C — two-account isolation test (do this manually) ============
-- The SQL editor runs as a superuser and BYPASSES RLS, so you cannot test
-- isolation here. Test it as a real signed-in user instead:
--   1. Create two separate accounts (Family A and Family B), each with a child.
--   2. Sign in as Family A in the app. Open browser DevTools > Console.
--   3. Run (paste Family B's child id, which you can read as the DB owner):
--        const { createClient } = window.supabase ?? {}
--        // or use the app's client if exposed; otherwise use the REST endpoint:
--        // fetch(`${URL}/rest/v1/children?id=eq.<FAMILY_B_CHILD_ID>`,
--        //   { headers: { apikey: ANON, Authorization: `Bearer ${ACCESS_TOKEN}` }})
--   4. EXPECTED: 0 rows / empty. If you get Family B's data back, RLS is not
--      protecting you.


-- =====================================================================
-- PART D — RECOMMENDED POLICY TEMPLATE  (REVIEW + TEST BEFORE RUNNING)
-- =====================================================================
-- This is a STARTING POINT based on the app's schema, not a guaranteed
-- drop-in. Column names are inferred from the code. Apply table by table
-- and test the app after each. Adjust types if your ids are not uuid.
--
-- Model: a signed-in user (auth.uid()) is a guardian of one or more families
-- via guardians.auth_user_id. Everything hangs off family membership:
--   family_id directly, or child_id -> children.family_id,
--   or task_id -> tasks.family_id.

-- Helper: the family ids the current user belongs to. SECURITY DEFINER so it
-- can read guardians without tripping that table's own RLS (avoids recursion).
create or replace function public.my_family_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.guardians where auth_user_id = auth.uid()
$$;

-- Helper: the child ids in the current user's families.
create or replace function public.my_child_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.children where family_id in (select public.my_family_ids())
$$;

/*  ---- Enable RLS + policies (uncomment to apply, one block at a time) ----

-- FAMILIES
alter table public.families enable row level security;
create policy fam_select on public.families for select using (id in (select public.my_family_ids()));
create policy fam_mod    on public.families for update using (id in (select public.my_family_ids()));
-- NOTE: family INSERT happens during signup/setup BEFORE the guardian row exists,
-- so allow any authenticated user to create a family:
create policy fam_insert on public.families for insert to authenticated with check (true);

-- GUARDIANS (a user manages guardian rows in their own families; can insert self)
alter table public.guardians enable row level security;
create policy grd_select on public.guardians for select using (family_id in (select public.my_family_ids()));
create policy grd_insert on public.guardians for insert to authenticated with check (auth_user_id = auth.uid() or family_id in (select public.my_family_ids()));
create policy grd_update on public.guardians for update using (family_id in (select public.my_family_ids()));
create policy grd_delete on public.guardians for delete using (family_id in (select public.my_family_ids()));

-- CHILDREN
alter table public.children enable row level security;
create policy chd_all on public.children for all
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

-- TASKS
alter table public.tasks enable row level security;
create policy tsk_all on public.tasks for all
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

-- REWARDS
alter table public.rewards enable row level security;
create policy rwd_all on public.rewards for all
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

-- TASK_ASSIGNMENTS (via task -> family)
alter table public.task_assignments enable row level security;
create policy tas_all on public.task_assignments for all
  using (task_id in (select id from public.tasks where family_id in (select public.my_family_ids())))
  with check (task_id in (select id from public.tasks where family_id in (select public.my_family_ids())));

-- TASK_BENCHMARK_PHOTOS (via task -> family)
alter table public.task_benchmark_photos enable row level security;
create policy tbp_all on public.task_benchmark_photos for all
  using (task_id in (select id from public.tasks where family_id in (select public.my_family_ids())))
  with check (task_id in (select id from public.tasks where family_id in (select public.my_family_ids())));

-- CHILD-SCOPED TABLES: completions, star_ledger, redemptions, spin_results, praises
alter table public.completions enable row level security;
create policy cmp_all on public.completions for all
  using (child_id in (select public.my_child_ids())) with check (child_id in (select public.my_child_ids()));

alter table public.star_ledger enable row level security;
create policy sl_all on public.star_ledger for all
  using (child_id in (select public.my_child_ids())) with check (child_id in (select public.my_child_ids()));

alter table public.redemptions enable row level security;
create policy rdm_all on public.redemptions for all
  using (child_id in (select public.my_child_ids())) with check (child_id in (select public.my_child_ids()));

alter table public.spin_results enable row level security;
create policy spn_all on public.spin_results for all
  using (child_id in (select public.my_child_ids())) with check (child_id in (select public.my_child_ids()));

alter table public.praises enable row level security;
create policy prs_all on public.praises for all
  using (child_id in (select public.my_child_ids())) with check (child_id in (select public.my_child_ids()));

-- GUARDIAN_INVITATIONS — TRICKY: the /join/<token> flow must read an invite by
-- token BEFORE the invitee is a guardian. Two safe options:
--   (a) Keep the join lookup on the SERVER (service role) only, and restrict
--       client access to your own family's invites:
alter table public.guardian_invitations enable row level security;
create policy inv_family on public.guardian_invitations for all
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));
--   (b) OR add a SECURITY DEFINER RPC like redeem_invitation(token) so the token
--       lookup/accept happens without exposing the whole table. Verify how
--       app/join/[token]/page.tsx currently reads it and pick accordingly.

*/

-- STORAGE: also check the 'kid-avatars' and 'task-benchmarks' buckets. Child
-- photos should NOT be world-readable. Review Storage > Policies in the
-- dashboard and scope object access to the owning family (path is family_id/...).
