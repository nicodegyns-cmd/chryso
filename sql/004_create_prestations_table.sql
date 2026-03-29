-- 004_create_prestations_table.sql
-- Table to store prestation requests from personnel (PostgreSQL-compatible)

CREATE TABLE IF NOT EXISTS prestations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT DEFAULT NULL,
  analytic_id BIGINT DEFAULT NULL,
  date DATE DEFAULT NULL,
  pay_type VARCHAR(100) DEFAULT NULL,
  hours_actual NUMERIC(6,2) DEFAULT NULL,
  garde_hours NUMERIC(6,2) DEFAULT NULL,
  sortie_hours NUMERIC(6,2) DEFAULT NULL,
  overtime_hours NUMERIC(6,2) DEFAULT NULL,
  remuneration_infi NUMERIC(10,2) DEFAULT NULL,
  remuneration_med NUMERIC(10,2) DEFAULT NULL,
  comments TEXT DEFAULT NULL,
  proof_image TEXT DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'En attente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes (Postgres syntax)
CREATE INDEX IF NOT EXISTS idx_user ON prestations (user_id);
CREATE INDEX IF NOT EXISTS idx_analytic ON prestations (analytic_id);
CREATE INDEX IF NOT EXISTS idx_date ON prestations (date);
CREATE INDEX IF NOT EXISTS idx_status ON prestations (status);

-- Example insert (for testing):
-- INSERT INTO prestations (user_id, analytic_id, date, pay_type, hours_actual, remuneration_infi, remuneration_med, status)
-- VALUES (1, NULL, '2026-03-10', 'Garde', 8, 45.00, 120.00, 'En attente');
