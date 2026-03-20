-- 006_add_ebrigade_id_to_users.sql
-- Ajoute la colonne `ebrigade_id` à la table `users` pour stocker l'identifiant externe

ALTER TABLE `users`
  ADD COLUMN `ebrigade_id` VARCHAR(255) NULL UNIQUE AFTER `email`;

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS `idx_users_ebrigade` ON `users` (`ebrigade_id`);
