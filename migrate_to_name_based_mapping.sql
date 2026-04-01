-- Migration: Switch from code-based to name-based eBrigade mapping
-- Create new table for activity ↔ eBrigade NAME associations

BEGIN;

-- Create new table for name-based mapping
CREATE TABLE IF NOT EXISTS activity_ebrigade_name_mappings (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  ebrigade_analytic_name_pattern VARCHAR(255) NOT NULL,  -- e.g., "Permanence INFI", "Ambulance"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, ebrigade_analytic_name_pattern)
);

-- Copy existing mappings that are 4-digit codes and convert them to name patterns
-- For now, keep the old table for backwards compatibility
-- We'll migrate data progressively

COMMIT;
