#!/bin/bash

# Deploy migration to fix foreign key constraint on prestations.analytic_id

HOST="ay177071-001.eu.clouddb.ovh.net"
PORT="35230"
USER="fenix"
PASSWORD="Toulouse94"
DATABASE="fenix"

export PGPASSWORD="$PASSWORD"

# Execute the migration
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" << EOF
-- Migration: Make analytic_id nullable for prestations to allow manual entries without analytics

ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics;

ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL;

ALTER TABLE prestations ADD CONSTRAINT fk_prestations_analytics 
  FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL;

-- Verify the change
\d prestations
EOF

echo "✓ Migration completed successfully"
