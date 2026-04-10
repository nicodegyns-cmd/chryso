#!/bin/bash

export PGPASSWORD="Toulouse94"

echo "=== Vérification des mappings eBrigade → Activités locales ==="
echo ""

echo "1. Table activity_ebrigade_name_mappings:"
psql -h ay177071-001.eu.clouddb.ovh.net -p 35230 -U fenix -d fenix -c "
SELECT 
  nam.ebrigade_analytic_name_pattern, 
  nam.activity_id, 
  act.id as activity_id_check,
  act.pay_type,
  act.analytic_id
FROM activity_ebrigade_name_mappings nam 
LEFT JOIN activities act ON nam.activity_id = act.id
ORDER BY nam.ebrigade_analytic_name_pattern;
"

echo ""
echo "2. Vérification des analytiques associées:"
psql -h ay177071-001.eu.clouddb.ovh.net -p 35230 -U fenix -d fenix -c "
SELECT 
  'MAPPING manquant' as issue,
  COUNT(*) as count
FROM activity_ebrigade_name_mappings nam 
LEFT JOIN activities act ON nam.activity_id = act.id
WHERE act.id IS NULL

UNION ALL

SELECT 
  'ACTIVITY sans analytic_id' as issue,
  COUNT(*) as count
FROM activity_ebrigade_name_mappings nam 
JOIN activities act ON nam.activity_id = act.id
WHERE act.analytic_id IS NULL;
"

echo ""
echo "3. Toutes les activités (pour info):"
psql -h ay177071-001.eu.clouddb.ovh.net -p 35230 -U fenix -d fenix -c "
SELECT id, pay_type, analytic_id FROM activities ORDER BY id;
"
