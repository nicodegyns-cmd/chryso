-- 005_alter_activities_add_remuneration.sql
-- Ajoute les colonnes de rémunération à la table activities

ALTER TABLE `activities`
  ADD COLUMN `remuneration_infi` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `remuneration_med` DECIMAL(10,2) DEFAULT NULL;
