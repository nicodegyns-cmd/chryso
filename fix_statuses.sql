-- Fix status values to all be in French
UPDATE prestations SET status = 'Payé' WHERE status = 'paid';
UPDATE prestations SET status = 'Facturé' WHERE status = 'invoiced';
UPDATE prestations SET status = 'Envoyé à la facturation' WHERE status = 'sent_to_billing';

-- Verify the fix
SELECT id, invoice_number, status FROM prestations ORDER BY created_at DESC LIMIT 10;