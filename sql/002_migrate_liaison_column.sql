-- 002_migrate_liaison_column.sql
-- Script de migration pour renommer / ajouter la colonne liaison_ebrigade_id

-- 1) Si ta table existante a la colonne `liaison_eve_id` et que tu veux la renommer :
-- (Exécute cette commande)
ALTER TABLE `users` 
  CHANGE COLUMN `liaison_eve_id` `liaison_ebrigade_id` VARCHAR(100) DEFAULT NULL;

-- 2) Si la colonne précédente n'existe pas, ajoute la nouvelle colonne (compatible MySQL 8+):
-- (Utilise cette commande si la précédente échoue)
ALTER TABLE `users` 
  ADD COLUMN IF NOT EXISTS `liaison_ebrigade_id` VARCHAR(100) DEFAULT NULL;

-- 3) Optionnel : ajouter un index si nécessaire
CREATE INDEX IF NOT EXISTS `idx_liaison_ebrigade` ON `users` (`liaison_ebrigade_id`);

-- Note :
-- - Certaines versions de MySQL n'acceptent pas `IF NOT EXISTS` pour ADD COLUMN ni CREATE INDEX.
--   Si tu utilises une version plus ancienne, vérifie via INFORMATION_SCHEMA avant d'exécuter
--   ou exécute manuellement la commande ALTER TABLE ADD COLUMN quand la colonne est absente.
