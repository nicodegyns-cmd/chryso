-- 008_create_roles_table.sql (Postgres)
-- Crée une table `roles` et insère les rôles standards utilisés par l'application.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (code, label) VALUES
  ('INFI', 'Infirmier / Infirmière'),
  ('MED', 'Médecin'),
  ('admin', 'Administrateur'),
  ('moderator', 'Modérateur')
ON CONFLICT (code) DO NOTHING;
