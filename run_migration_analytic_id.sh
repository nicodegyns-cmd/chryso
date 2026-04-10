#!/bin/bash

# Deploy the migration directly on the server
export PGPASSWORD="Toulouse94"

echo "=== Migration: Make analytic_id nullable in prestations ==="
echo ""

# Run the migration
psql -h ay177071-001.eu.clouddb.ovh.net -p 35230 -U fenix -d fenix <<'EOF'
-- Step 1: Drop existing FK constraint
ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics;

-- Step 2: Make analytic_id nullable
ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL;

-- Step 3: Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE prestations
ADD CONSTRAINT fk_prestations_analytics
FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL;

-- Step 4: Verify
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'prestations' AND column_name = 'analytic_id';

echo "" && echo "✅ Migration completed successfully!"
EOF
