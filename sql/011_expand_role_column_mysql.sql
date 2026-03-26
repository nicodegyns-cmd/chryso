-- 011_expand_role_column_mysql.sql
-- Augmenter la colonne `role` pour supporter plusieurs rôles séparés par des virgules (MySQL version)

ALTER TABLE users MODIFY COLUMN role VARCHAR(255) NOT NULL DEFAULT 'user';

-- Notes:
-- This migration increases the role column from VARCHAR(32) to VARCHAR(255)
-- to accommodate comma-separated role lists like "admin,comptabilite,INFI"
