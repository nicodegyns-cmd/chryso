-- 002_migrate_liaison_column.sql
-- Script de migration pour renommer / ajouter la colonne liaison_ebrigade_id (Postgres)

-- NOTE: éviter 'RENAME COLUMN IF EXISTS' qui n'est pas supporté partout.
-- On crée la colonne si elle n'existe pas. Si tu dois conserver les données
-- depuis une ancienne colonne `liaison_eve_id`, fais une migration manuelle.

-- 1) S'assurer que la colonne `liaison_ebrigade_id` existe :
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS liaison_ebrigade_id VARCHAR(100) DEFAULT NULL;

-- 2) Ajouter l'index si nécessaire
CREATE INDEX IF NOT EXISTS idx_liaison_ebrigade ON users (liaison_ebrigade_id);
