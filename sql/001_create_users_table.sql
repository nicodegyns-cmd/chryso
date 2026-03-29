-- 001_create_users_table.sql
-- Schéma de la table `users` pour PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',

  first_name VARCHAR(120) DEFAULT NULL,
  last_name VARCHAR(120) DEFAULT NULL,
  ninami VARCHAR(64) DEFAULT NULL,
  telephone VARCHAR(32) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  niss VARCHAR(64) DEFAULT NULL,
  bce VARCHAR(64) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL,
  account VARCHAR(255) DEFAULT NULL,

  -- Liaison vers un profil externe Ebrigade
  liaison_ebrigade_id VARCHAR(100) DEFAULT NULL,

  password_reset_token VARCHAR(128) DEFAULT NULL,
  password_reset_sent_at TIMESTAMP DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_liaison_ebrigade ON users (liaison_ebrigade_id);

-- Remarques:
-- - `email` est unique et utilisé comme login.
-- - Le mot de passe est attendu après que l'utilisateur ait créé son mot de passe
--   via le lien envoyé dans l'e-mail de bienvenue (stocké dans password_reset_token).
-- - Si tu veux créer une FK vers une table `ebrigade_profiles`, remplace
--   `liaison_ebrigade_id` par la colonne correspondante et ajoute la contrainte FOREIGN KEY.
