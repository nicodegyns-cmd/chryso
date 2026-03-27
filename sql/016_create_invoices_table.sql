-- Migration: Create invoices table for billing management
-- 2024-03-26

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  due_date TIMESTAMP DEFAULT NULL,
  paid_date TIMESTAMP DEFAULT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT
);

CREATE INDEX IF NOT EXISTS idx_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_user_id ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_due_date ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_user_status ON invoices (user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_period ON invoices (created_at, status);
