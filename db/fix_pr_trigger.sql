-- Fix: personal_records_set_id_fkey FK violation on set insert
-- -----------------------------------------------------------------
-- Symptom: POST /rest/v1/sets returns 409 with
--   code: 23503
--   message: 'insert or update on table "personal_records" violates
--             foreign key constraint "personal_records_set_id_fkey"'
--   details: 'Key is not present in table "sets".'
--
-- Cause: The original trg_check_pr trigger ran BEFORE INSERT/UPDATE on
-- public.sets and tried to INSERT INTO personal_records with
-- set_id = NEW.id. The parent sets row didn't exist yet at BEFORE-time,
-- so the FK personal_records.set_id -> sets(id) failed.
--
-- Fix: split the logic into two triggers.
--   - BEFORE trigger flags NEW.is_pr (must be BEFORE so the column is
--     written with the row).
--   - AFTER trigger does the personal_records upsert (NEW.id is now a
--     valid FK target).
--
-- This file matches the migration applied to project scagcmcbayimzmcmggqr
-- via supabase MCP: name "fix_pr_trigger_split_before_after".

CREATE OR REPLACE FUNCTION public.mark_pr_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_kg_total numeric;
  v_pr_total numeric;
BEGIN
  IF NEW.completed = false OR NEW.exercise = 'accessory' THEN
    RETURN NEW;
  END IF;

  v_kg_total := NEW.kg_whole + CASE WHEN NEW.kg_half THEN 0.5 ELSE 0 END;

  SELECT kg_whole + CASE WHEN kg_half THEN 0.5 ELSE 0 END
    INTO v_pr_total
    FROM personal_records
   WHERE exercise = NEW.exercise;

  IF v_pr_total IS NULL OR v_kg_total > v_pr_total THEN
    NEW.is_pr := TRUE;
  ELSE
    NEW.is_pr := COALESCE(NEW.is_pr, FALSE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pr_after()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_kg_total numeric;
  v_pr_whole integer;
  v_pr_half  boolean;
BEGIN
  IF NEW.is_pr IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  v_kg_total := NEW.kg_whole + CASE WHEN NEW.kg_half THEN 0.5 ELSE 0 END;
  v_pr_whole := floor(v_kg_total)::integer;
  v_pr_half  := (v_kg_total - floor(v_kg_total)) >= 0.5;

  INSERT INTO personal_records (exercise, kg_whole, kg_half, achieved_on, set_id, updated_at)
  VALUES (
    NEW.exercise,
    v_pr_whole,
    v_pr_half,
    (SELECT date FROM sessions WHERE id = NEW.session_id),
    NEW.id,
    now()
  )
  ON CONFLICT (exercise) DO UPDATE SET
    kg_whole    = excluded.kg_whole,
    kg_half     = excluded.kg_half,
    achieved_on = excluded.achieved_on,
    set_id      = excluded.set_id,
    updated_at  = now();

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_pr ON public.sets;

DROP TRIGGER IF EXISTS trg_mark_pr_before  ON public.sets;
DROP TRIGGER IF EXISTS trg_record_pr_after ON public.sets;

CREATE TRIGGER trg_mark_pr_before
BEFORE INSERT OR UPDATE ON public.sets
FOR EACH ROW EXECUTE FUNCTION public.mark_pr_before();

CREATE TRIGGER trg_record_pr_after
AFTER INSERT OR UPDATE ON public.sets
FOR EACH ROW EXECUTE FUNCTION public.record_pr_after();
