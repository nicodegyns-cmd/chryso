-- 008_create_roles_table.sql (Postgres)
-- Crée une table `roles` et insère les rôles standards utilisés par l'application.

-- Créer la table des rôles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insérer les rôles canoniques (éviter les doublons)
INSERT INTO roles (code, label) VALUES
  ('INFI', 'Infirmier / Infirmière'),
  ('MED', 'Médecin'),
  ('admin', 'Administrateur'),
  ('moderator', 'Modérateur')
ON CONFLICT (code) DO NOTHING;

-- NOTE:
-- Ce script crée uniquement une table de référence pour les rôles.
-- Il n'impose pas de contrainte de clé étrangère sur users.role afin d'éviter
-- des ruptures sur des bases existantes. Si vous souhaitez migrer users pour
-- utiliser une clé étrangère role_id, je peux fournir un script additionnel
-- qui ajoutera la colonne, peuplera role_id à partir de users.role puis
-- appliquera la contrainte.
