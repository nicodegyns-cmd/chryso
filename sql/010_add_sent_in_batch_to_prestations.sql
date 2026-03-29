ALTER TABLE prestations
	ADD COLUMN IF NOT EXISTS sent_in_batch_id INTEGER DEFAULT NULL;

-- Drop existing FK if present, then add the FK constraint (idempotent)
ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_sent_in_batch;
ALTER TABLE prestations
	ADD CONSTRAINT fk_prestations_sent_in_batch
	FOREIGN KEY (sent_in_batch_id) REFERENCES pdf_sends(id) ON DELETE SET NULL;
