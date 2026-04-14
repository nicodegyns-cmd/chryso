-- Migration 023: excluded_invitation_emails (for people without a profile yet)
CREATE TABLE IF NOT EXISTS excluded_invitation_emails (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excl_inv_emails_email ON excluded_invitation_emails(LOWER(email));
