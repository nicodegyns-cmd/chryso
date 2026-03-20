ALTER TABLE prestations ADD COLUMN sent_in_batch_id INT NULL AFTER pdf_url;
ALTER TABLE prestations ADD FOREIGN KEY (sent_in_batch_id) REFERENCES pdf_sends(id) ON DELETE SET NULL;
