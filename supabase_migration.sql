-- Little Yakka — run this once in the Supabase SQL editor.
-- All statements are idempotent (safe to run more than once).
-- The app already falls back gracefully if these haven't run yet, but running
-- them lets the new fields actually persist.

-- 1) "Can be done early" toggle on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS can_do_early boolean DEFAULT true;

-- 2) Optional child age (collected in the setup wizard)
ALTER TABLE children ADD COLUMN IF NOT EXISTS age int;

-- 3) Bonus Wheel award value (% of the period's available stars; default 50%)
ALTER TABLE families ADD COLUMN IF NOT EXISTS bonus_award_pct int DEFAULT 50;

-- 4) Allow 'manual' star adjustments from Settings.
--    (The Settings star +/- already falls back to a valid value if this isn't run,
--     but this keeps the ledger labelled correctly.)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'star_ledger'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source_type%'
  LIMIT 1;
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE star_ledger DROP CONSTRAINT %I', c);
    ALTER TABLE star_ledger
      ADD CONSTRAINT star_ledger_source_type_check
      CHECK (source_type IN ('completion','undo','redemption','spin','manual','bonus','adjustment'));
  END IF;
END $$;

-- 5) Enable Realtime for co-parent live sync (completions, stars, redemptions).
--    Without this the app still works — it just won't update live for a second parent.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE completions; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE star_ledger;  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE redemptions;  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;

-- 6) Co-parent join: accept an invitation server-side (SECURITY DEFINER).
--    Validates the token, creates the guardian row with all required fields,
--    and marks the invite used — replaces the client-side insert that failed
--    silently and left new co-parents stuck at /setup.
create or replace function public.accept_invitation(invite_token text, guardian_name text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  uemail text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a family.';
  end if;

  select * into inv from public.guardian_invitations where token::text = invite_token;
  if inv is null then
    raise exception 'This invite link is invalid.';
  end if;
  if inv.used then
    raise exception 'This invite has already been used.';
  end if;

  -- Already a guardian somewhere? Keep previous behaviour: don't create a
  -- second guardian row, just consume the invite.
  if not exists (select 1 from public.guardians where auth_user_id = auth.uid()) then
    select email into uemail from auth.users where id = auth.uid();
    insert into public.guardians (auth_user_id, family_id, name, email, parent_pin)
    values (
      auth.uid(),
      inv.family_id,
      coalesce(nullif(guardian_name, ''), nullif(split_part(coalesce(uemail, ''), '@', 1), ''), 'Parent'),
      uemail,
      ''
    );
  end if;

  update public.guardian_invitations set used = true where id = inv.id;
end $$;

grant execute on function public.accept_invitation(text, text) to authenticated;

-- 7) "Up For Grabs" tasks — unassigned bounties any child can claim
--    (first done wins). Optional expiry date; blank = open until claimed.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS up_for_grabs boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expires_on date;

-- 8) v1.1 features: push notifications, savings goals, avatar style shop
-- Push subscriptions (one row per device that enabled notifications)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists push_subs_family on push_subscriptions;
create policy push_subs_family on push_subscriptions for all
  using (family_id in (select family_id from guardians where auth_user_id = auth.uid()))
  with check (family_id in (select family_id from guardians where auth_user_id = auth.uid()));

-- Savings goal per child ("Save 200 stars for a scooter")
alter table children add column if not exists goal_title text;
alter table children add column if not exists goal_emoji text;
alter table children add column if not exists goal_target int;

-- Avatar style shop (hats + frames bought with stars)
alter table children add column if not exists equipped_hat text;
alter table children add column if not exists equipped_frame text;
create table if not exists child_unlocks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  item_id text not null,
  created_at timestamptz default now(),
  unique (child_id, item_id)
);
alter table child_unlocks enable row level security;
drop policy if exists child_unlocks_family on child_unlocks;
create policy child_unlocks_family on child_unlocks for all
  using (child_id in (select id from children where family_id in (select family_id from guardians where auth_user_id = auth.uid())))
  with check (child_id in (select id from children where family_id in (select family_id from guardians where auth_user_id = auth.uid())));
