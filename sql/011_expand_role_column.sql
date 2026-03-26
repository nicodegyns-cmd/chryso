-- 011_expand_role_column.sql
-- Augmenter la colonne `role` pour supporter plusieurs rôles séparés par des virgules

BEGIN;

-- For PostgreSQL
ALTER TABLE users
  ALTER COLUMN role TYPE VARCHAR(255);

-- Ensure the column still has NOT NULL and DEFAULT
ALTER TABLE users
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'user';

COMMIT;

-- Notes:
-- This migration increases the role column from VARCHAR(32) to VARCHAR(255)
-- to accommodate comma-separated role lists like "admin,comptabilite,INFI"
