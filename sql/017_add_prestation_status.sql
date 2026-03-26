-- Migration: Add status column to prestations table if it doesn't exist
-- Status values: pending, sent_to_billing, invoiced, paid

ALTER TABLE prestations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_prestation_status ON prestations(status);
CREATE INDEX IF NOT EXISTS idx_prestation_status_date ON prestations(status, date);
