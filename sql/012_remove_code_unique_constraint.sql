-- Migration 012: Remove UNIQUE constraint on analytics.code
-- Allows multiple analytics with the same code

-- Drop unique constraint / index names commonly created by UNIQUE.
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_code_key;
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_code_unique;

-- Drop indexes that may have been created for the UNIQUE constraint.
DROP INDEX IF EXISTS idx_code;
DROP INDEX IF EXISTS analytics_code_idx;
DROP INDEX IF EXISTS analytics_code_key;
DROP INDEX IF EXISTS analytics_code;
