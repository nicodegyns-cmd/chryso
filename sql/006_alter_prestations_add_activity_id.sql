-- 006_alter_prestations_add_activity_id.sql
-- Add activity_id to prestations to link a prestation to the originating activity

ALTER TABLE prestations
  ADD COLUMN activity_id BIGINT UNSIGNED DEFAULT NULL,
  ADD INDEX idx_activity_id (activity_id);
