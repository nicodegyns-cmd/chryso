-- Mettre à jour toutes les URLs de PDF en base de données
-- Old format: /exports/prestation-xxx.pdf
-- New format: /api/exports/download?file=prestation-xxx.pdf

UPDATE prestations 
SET pdf_url = CONCAT('/api/exports/download?file=', SUBSTRING(pdf_url, 10))
WHERE pdf_url LIKE '/exports/prestation-%'
AND pdf_url NOT LIKE '/api/exports/%';

-- Vérifier les changements
SELECT id, pdf_url FROM prestations WHERE pdf_url IS NOT NULL LIMIT 5;
