-- 006_alter_prestations_add_activity_id.sql (Postgres)
-- Add activity_id to prestations to link a prestation to the originating activity

ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS activity_id BIGINT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_id ON prestations (activity_id);
