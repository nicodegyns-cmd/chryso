-- Migration: Add invitation and onboarding tracking to users table
-- For bulk user import and self-service registration flow

ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(128) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'active'; -- 'pending_signup', 'pending_validation', 'active'
ALTER TABLE users ADD COLUMN IF NOT EXISTS import_batch_id VARCHAR(100) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invitation_token ON users(invitation_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON users(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_import_batch ON users(import_batch_id);
