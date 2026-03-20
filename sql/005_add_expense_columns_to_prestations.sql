-- 005_add_expense_columns_to_prestations.sql
-- Add columns to store note de frais info when a proof image is uploaded

ALTER TABLE `prestations`
  ADD COLUMN `expense_amount` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `expense_comment` TEXT DEFAULT NULL;

-- After running this migration, the API will accept and persist expense_amount and expense_comment.
