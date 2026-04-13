-- Migration: Add validation tracking columns to prestations table
-- This allows tracking who validated/approved each prestation and when

ALTER TABLE prestations ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP DEFAULT NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS validated_by_id BIGINT DEFAULT NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS validated_by_email VARCHAR(255) DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prestations_validated_at ON prestations(validated_at);
CREATE INDEX IF NOT EXISTS idx_prestations_validated_by_id ON prestations(validated_by_id);
