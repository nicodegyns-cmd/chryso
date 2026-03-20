UPDATE prestations SET status = 'Envoyé à la facturation' 
WHERE pdf_url IS NOT NULL AND pdf_url != '' 
AND status = 'En attente d\'envoie' 
AND sent_in_batch_id IS NULL;
