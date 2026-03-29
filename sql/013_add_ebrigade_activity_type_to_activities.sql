-- Add explicit eBrigade activity type link to activities table
-- This allows explicit mapping between local activities and eBrigade participation types

ALTER TABLE activities ADD COLUMN IF NOT EXISTS ebrigade_activity_type VARCHAR(100) DEFAULT NULL;

-- Add index for faster lookups when matching eBrigade participations
CREATE INDEX IF NOT EXISTS idx_ebrigade_activity_type ON activities(ebrigade_activity_type);
