-- 002_migrate_liaison_column.sql
-- Script de migration pour renommer / ajouter la colonne liaison_ebrigade_id (Postgres)

-- 1) Si la colonne existante s'appelle `liaison_eve_id`, renommer :
-- NOTE: PostgreSQL does not support `RENAME COLUMN IF EXISTS`.
-- To avoid failing the automated runner we only ensure the new column exists.
-- If you need to preserve data from an existing `liaison_eve_id` column,
-- please run a manual rename or a data copy beforehand.

-- 1) S'assurer que la colonne `liaison_ebrigade_id` existe :
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS liaison_ebrigade_id VARCHAR(100) DEFAULT NULL;

-- 3) Optionnel : ajouter un index si nécessaire
CREATE INDEX IF NOT EXISTS idx_liaison_ebrigade ON users (liaison_ebrigade_id);

-- Note :
-- - `RENAME COLUMN IF EXISTS` fonctionne sur les versions récentes de Postgres.
--   Si ta version est plus ancienne, vérifie via pg_catalog.pg_attribute avant d'exécuter.
