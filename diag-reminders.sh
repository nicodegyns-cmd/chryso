#!/bin/bash
DB="postgresql://fenix:Toulouse94@ay177071-001:35230/fenix"

echo "=== Prestations >= 2026-05-01 (status + reminder flags) ==="
PGPASSWORD=Toulouse94 psql "$DB" <<'SQL'
SELECT id, date, status, reminder_1_sent_at, reminder_2_sent_at
FROM prestations
WHERE date >= '2026-05-01'
ORDER BY date DESC
LIMIT 20;
SQL

echo ""
echo "=== Distinct statuses in prestations >= 2026-05-01 ==="
PGPASSWORD=Toulouse94 psql "$DB" <<'SQL'
SELECT status, count(*) FROM prestations WHERE date >= '2026-05-01' GROUP BY status;
SQL

echo ""
echo "=== Reminder 1 candidates right now ==="
PGPASSWORD=Toulouse94 psql "$DB" <<'SQL'
SELECT id, date, status, NOW() - (date::date)::timestamp AS elapsed
FROM prestations
WHERE date >= '2026-05-01'
  AND reminder_1_sent_at IS NULL
  AND (NOW() - (date::date)::timestamp) >= INTERVAL '24 hours'
  AND (NOW() - (date::date)::timestamp) < INTERVAL '36 hours';
SQL

echo ""
echo "=== Reminder 2 candidates right now ==="
PGPASSWORD=Toulouse94 psql "$DB" <<'SQL'
SELECT id, date, status, NOW() - (date::date)::timestamp AS elapsed
FROM prestations
WHERE date >= '2026-05-01'
  AND reminder_2_sent_at IS NULL
  AND (NOW() - (date::date)::timestamp) >= INTERVAL '36 hours'
  AND (NOW() - (date::date)::timestamp) < INTERVAL '48 hours';
SQL
