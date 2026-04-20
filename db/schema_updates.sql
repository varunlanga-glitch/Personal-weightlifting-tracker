-- Run these in the Supabase SQL Editor (project scagcmcbayimzmcmggqr)
-- Safe to run more than once.

-- 1. Support half-point RPE values (7.5, 8.5, etc.)
ALTER TABLE sets ALTER COLUMN rpe TYPE numeric(3,1);

-- 2. Editable year-end targets stored per user
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS targets jsonb;

-- 3. Track which accessories were completed each session
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS accessories_done jsonb DEFAULT '[]'::jsonb;
