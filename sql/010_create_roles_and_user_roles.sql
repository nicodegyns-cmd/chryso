-- 010_create_roles_and_user_roles.sql
-- Migration Postgres : normaliser les rôles avec une table `roles` et une table de liaison `user_roles`.
-- Backfill depuis la colonne existante `users.role` (gère les valeurs séparées par des virgules).

BEGIN;

-- 1) create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE
);

-- 2) create join table user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE;

-- 3) backfill distinct role names from users.role (comma separated)
INSERT INTO roles (name)
SELECT DISTINCT trim(r) AS name
FROM (
  SELECT regexp_split_to_table(coalesce(role, ''), '\\s*,\\s*') AS r FROM users
) s
WHERE trim(r) <> ''
ON CONFLICT DO NOTHING;

-- 4) backfill user_roles from users.role values
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u,
     regexp_split_to_table(coalesce(u.role, ''), '\\s*,\\s*') AS role_name
JOIN roles r ON trim(role_name) = r.name
WHERE trim(role_name) <> ''
ON CONFLICT DO NOTHING;

-- 5) (optional) set users.role to the first role (keeps backward compatibility)
UPDATE users
SET role = sub.first_role
FROM (
  SELECT u.id AS uid, (array_agg(r.name ORDER BY r.id))[1] AS first_role
  FROM users u
  JOIN LATERAL regexp_split_to_table(coalesce(u.role, ''), '\\s*,\\s*') AS rn(role_name) ON true
  JOIN roles r ON trim(rn.role_name) = r.name
  GROUP BY u.id
) AS sub
WHERE users.id = sub.uid;

-- 6) helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

COMMIT;

-- Notes:
-- - After this migration, server code should read roles from the join table when needed.
-- - You can drop or deprecate the old `users.role` column after verifying the app works.
