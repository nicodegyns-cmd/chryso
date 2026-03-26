-- Migration: Add analytic_id to invoices
-- Allows linking an invoice to an analytic and displaying its name

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS analytic_id BIGINT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS analytic_note VARCHAR(255) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_analytic_id ON invoices(analytic_id);

-- Note: after adding the column, existing invoices can be updated to set analytic_id
-- using available analytics (e.g. UPDATE invoices SET analytic_id = <id> WHERE ...)
