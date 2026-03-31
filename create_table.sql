CREATE TABLE IF NOT EXISTS activity_ebrigade_mappings (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  ebrigade_analytic_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, ebrigade_analytic_name)
);

CREATE INDEX IF NOT EXISTS idx_activity_ebrigade_mappings_activity_id ON activity_ebrigade_mappings(activity_id);
