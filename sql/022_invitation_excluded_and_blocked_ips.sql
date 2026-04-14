-- Migration 022: invitation_excluded flag on users + blocked_ips table

-- 1. Add invitation_excluded column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_excluded BOOLEAN DEFAULT FALSE;

-- 2. Create blocked_ips table
CREATE TABLE IF NOT EXISTS blocked_ips (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason TEXT,
  blocked_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);
