ALTER TABLE users ADD COLUMN IF NOT EXISTS must_complete_profile BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_cgu BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy BOOLEAN DEFAULT false;
SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('must_complete_profile','accepted_cgu','accepted_privacy');
