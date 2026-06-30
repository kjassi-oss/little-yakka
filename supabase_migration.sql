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
