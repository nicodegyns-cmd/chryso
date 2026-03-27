-- 006_add_ebrigade_id_to_users.sql (Postgres)
-- Ajoute la colonne `ebrigade_id` à la table `users` pour stocker l'identifiant externe

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ebrigade_id VARCHAR(255) DEFAULT NULL;

-- Crée un index unique pour garantir l'unicité (équivalent MySQL UNIQUE column)
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_ebrigade ON users (ebrigade_id);
