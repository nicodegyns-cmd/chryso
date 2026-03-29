-- 007_update_users_role_user_to_infi.sql
-- Backup users with role='user' then update their role to 'INFI'
-- IMPORTANT: run a full DB backup before applying in production.

-- Optional full DB dump (run from shell):
-- "C:\\xampp\\mysql\\bin\\mysqldump.exe" -u root -p chryso > chryso-backup.sql

-- Create a lightweight backup table for affected rows
DROP TABLE IF EXISTS users_role_user_backup;
CREATE TABLE users_role_user_backup AS
SELECT id, email, role, created_at, updated_at FROM users WHERE role = 'user';

-- Show how many rows will be updated (for information when running interactively)
SELECT COUNT(*) AS will_update FROM users WHERE role = 'user';

-- Perform the update
-- Perform the update and return updated ids so we can count them in Postgres
WITH updated AS (
	UPDATE users
	SET role = 'INFI'
	WHERE role = 'user'
	RETURNING id
)
SELECT COUNT(*) AS updated_count FROM updated;

-- If you need to revert the change for any reason, you can restore roles from the backup table:
-- UPDATE users u JOIN users_role_user_backup b ON u.id = b.id SET u.role = b.role;

