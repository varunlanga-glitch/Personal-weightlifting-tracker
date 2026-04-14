-- Fix: personal_records_set_id_fkey FK violation on set insert
-- -----------------------------------------------------------------
-- Symptom: POST /rest/v1/sets returns 409 with
--   code: 23503
--   message: 'insert or update on table "personal_records" violates
--             foreign key constraint "personal_records_set_id_fkey"'
--   details: 'Key is not present in table "sets".'
--
-- Cause: The PR-detection trigger fires BEFORE INSERT on sets (or uses
-- OLD/NEW in a way that inserts into personal_records before the parent
-- sets row exists). personal_records.set_id has an FK to sets(id), so
-- the FK check fails.
--
-- Run steps 1 and 2 in the Supabase SQL Editor:

-- 1) See what triggers exist on sets
SELECT tgname, tgtype,
       pg_get_triggerdef(oid) AS definition
FROM   pg_trigger
WHERE  tgrelid = 'public.sets'::regclass
AND    NOT tgisinternal;

-- 2) Replace the function body so it runs AFTER the set is committed.
--    Adjust the function name if step 1 shows a different one.
--    This version:
--      - runs AFTER INSERT, so NEW.id is guaranteed valid
--      - only creates a personal_records row when the new set's weight
--        beats the current PR for that exercise
--      - marks the winning set's is_pr flag in place

CREATE OR REPLACE FUNCTION public.detect_pr()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prev_best NUMERIC;
  new_kg    NUMERIC;
BEGIN
  new_kg := NEW.kg_whole + CASE WHEN NEW.kg_half THEN 0.5 ELSE 0 END;

  SELECT COALESCE(MAX(kg_whole + CASE WHEN kg_half THEN 0.5 ELSE 0 END), 0)
    INTO prev_best
    FROM public.personal_records
   WHERE exercise = NEW.exercise;

  IF NEW.completed AND NEW.reps = 1 AND new_kg > prev_best THEN
    -- flag the set itself
    UPDATE public.sets
       SET is_pr = TRUE
     WHERE id = NEW.id;

    -- record the PR
    INSERT INTO public.personal_records (exercise, kg_whole, kg_half, achieved_on, set_id)
    VALUES (NEW.exercise, NEW.kg_whole, NEW.kg_half, CURRENT_DATE, NEW.id);
  END IF;

  RETURN NULL;  -- AFTER triggers ignore the return value, but NULL is explicit
END;
$$;

DROP TRIGGER IF EXISTS sets_detect_pr ON public.sets;
CREATE TRIGGER sets_detect_pr
AFTER INSERT ON public.sets
FOR EACH ROW
EXECUTE FUNCTION public.detect_pr();

-- 3) (optional) If step 1 showed a differently-named old trigger,
--    drop it too so it doesn't run alongside the new one:
-- DROP TRIGGER IF EXISTS <old_trigger_name> ON public.sets;
