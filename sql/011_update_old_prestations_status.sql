-- Ensure `pdf_url` column exists (some deployments may not have it yet)
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(512) DEFAULT NULL;

UPDATE prestations SET status = 'Envoyé à la facturation'
WHERE pdf_url IS NOT NULL AND pdf_url != ''
  AND status = 'En attente d''envoie'
  AND sent_in_batch_id IS NULL;
