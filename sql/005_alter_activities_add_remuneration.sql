-- 005_alter_activities_add_remuneration.sql (Postgres)
-- Ajoute les colonnes de rémunération à la table activities (idempotent)

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS remuneration_infi NUMERIC(10,2) DEFAULT NULL;

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS remuneration_med NUMERIC(10,2) DEFAULT NULL;
