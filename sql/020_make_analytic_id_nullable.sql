-- Migration: Make analytic_id nullable for prestations to allow manual entries without analytics

ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics;

ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL;

ALTER TABLE prestations ADD CONSTRAINT fk_prestations_analytics 
  FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL;
