#!/bin/bash
# Initialize database tables for audit

cd ~/chryso

# Initialize audit table via API
echo "Initializing acceptance audit table..."
curl -X POST http://localhost:3000/api/admin/audit/init \
  -H "Content-Type: application/json" \
  -d "{}" 2>/dev/null

echo "✓ Audit table initialized"
