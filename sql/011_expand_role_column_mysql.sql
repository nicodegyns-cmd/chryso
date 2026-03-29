-- 011_expand_role_column_mysql.sql
-- Converted to PostgreSQL-compatible statements

-- Increase column width and enforce NOT NULL + default in Postgres
ALTER TABLE users
	ALTER COLUMN role TYPE VARCHAR(255);
ALTER TABLE users
	ALTER COLUMN role SET NOT NULL;
ALTER TABLE users
	ALTER COLUMN role SET DEFAULT 'user';

-- Notes:
-- Original file used MySQL `MODIFY COLUMN`; replaced with Postgres ALTER COLUMN statements.
