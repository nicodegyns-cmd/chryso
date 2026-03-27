-- 005_add_expense_columns_to_prestations.sql (Postgres)
-- Add columns to store note de frais info when a proof image is uploaded

ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS expense_amount NUMERIC(10,2) DEFAULT NULL;

ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS expense_comment TEXT DEFAULT NULL;

-- After running this migration, the API will accept and persist expense_amount and expense_comment.
