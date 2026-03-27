-- 004_create_activities_table.sql
-- Table pour stocker les activités liées aux analytiques (Postgres)

CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  analytic_id BIGINT DEFAULT NULL,
  analytic_name VARCHAR(255) DEFAULT NULL,
  analytic_code VARCHAR(100) DEFAULT NULL,
  pay_type VARCHAR(50) DEFAULT NULL,
  date DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytic ON activities (analytic_id);

-- Foreign key constraint disabled for automated runner.
-- To add it manually:
-- ALTER TABLE activities ADD CONSTRAINT fk_activities_analytics
--   FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL;
