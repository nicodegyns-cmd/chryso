@echo off
REM Deploy migration to fix foreign key constraint on prestations.analytic_id
REM This allows manual prestation entries without selecting an analytics field

setlocal enabledelayedexpansion

set HOST=ay177071-001.eu.clouddb.ovh.net
set PORT=35230
set USER=fenix
set PASSWORD=Toulouse94
set DATABASE=fenix

set PGPASSWORD=%PASSWORD%

echo Executing migration: Make analytic_id nullable...
echo.

psql -h %HOST% -p %PORT% -U %USER% -d %DATABASE% << EOF
-- Migration: Make analytic_id nullable for prestations to allow manual entries without analytics
ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics;
ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL;
ALTER TABLE prestations ADD CONSTRAINT fk_prestations_analytics 
  FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL;
\d prestations
EOF

if %errorlevel% equ 0 (
    echo.
    echo ✓ Migration completed successfully!
) else (
    echo.
    echo ✗ Migration failed. Check the output above for errors.
    exit /b 1
)

endlocal
