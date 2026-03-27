-- 009_create_pdf_sends_table.sql (Postgres)
CREATE TABLE IF NOT EXISTS pdf_sends (
  id SERIAL PRIMARY KEY,
  analytic_id INTEGER,
  analytic_code VARCHAR(255),
  analytic_name VARCHAR(255),
  recipient_emails JSONB DEFAULT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_by VARCHAR(255),
  prestation_count INTEGER DEFAULT 0,
  first_prestation_date DATE,
  last_prestation_date DATE,
  filename VARCHAR(512),
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdf_sends_analytic_id ON pdf_sends (analytic_id);

ALTER TABLE pdf_sends DROP CONSTRAINT IF EXISTS chk_pdf_sends_status;
ALTER TABLE pdf_sends
  ADD CONSTRAINT chk_pdf_sends_status CHECK (status IN ('success','failed','partial'));
