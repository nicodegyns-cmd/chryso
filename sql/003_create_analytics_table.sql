-- 003_create_analytics_table.sql
-- Table pour stocker les analytiques (PostgreSQL-compatible)

CREATE TABLE IF NOT EXISTS analytics (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  analytic_type VARCHAR(32) NOT NULL DEFAULT 'PDF',
  code VARCHAR(100) NOT NULL UNIQUE,
  entite VARCHAR(100) DEFAULT NULL,
  distribution JSONB DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_code ON analytics (code);
CREATE INDEX IF NOT EXISTS idx_active ON analytics (is_active);

-- Exemple d'insertion (Postgres JSONB):
-- INSERT INTO analytics (name, analytic_type, code, entite, distribution, description)
-- VALUES ('Rapport mensuel', 'PDF', 'RPT-M-001', '787', '["ops@example.com","finance@example.com"]'::jsonb, 'Rapport généré chaque mois');
