# Test de Connexion PostgreSQL - Chryso

Ce script teste la connexion à Supabase PostgreSQL et vérifie que les tables ont été créées correctement.

## Prérequis

1. Variable d'environnement configurée:
```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:@Thesin2026@db.ujtkgekhbvalaadfniyn.supabase.co:5432/postgres"

# Linux/Mac
export DATABASE_URL="postgresql://postgres:@Thesin2026@db.ujtkgekhbvalaadfniyn.supabase.co:5432/postgres"
```

2. Migrations exécutées sur Supabase SQL Editor

## Test 1: Connexion Basique

```javascript
const { getPool } = require('./services/db')

async function testConnection() {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT NOW() as now')
    console.log('✅ Connection successful!', rows[0])
  } catch (err) {
    console.error('❌ Connection failed:', err)
  }
}

testConnection()
```

**Commande:**
```bash
node -e "require('dotenv').config(); const { getPool } = require('./services/db'); const pool = getPool(); pool.query('SELECT NOW() as now').then(([rows]) => { console.log('✅ Connection OK:', rows[0]); process.exit(0) }).catch(err => { console.error('❌ Error:', err.message); process.exit(1) })"
```

## Test 2: Vérifier les Tables

```bash
node -e "
require('dotenv').config();
const { getPool } = require('./services/db');
const pool = getPool();

async function checkTables() {
  try {
    const tables = ['users', 'roles', 'analytics', 'activities', 'prestations', 'pdf_sends'];
    for (const table of tables) {
      const [rows] = await pool.query('COUNT(*) FROM ' + table);
      console.log(\`✅ \${table}: OK\`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkTables();
"
```

## Test 3: Lister les Colonnes d'une Table

```bash
node -e "
require('dotenv').config();
const { getPool } = require('./services/db');
const pool = getPool();

async function checkSchema() {
  try {
    const [rows] = await pool.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position\");
    console.log('Users table columns:');
    rows.forEach(r => console.log('  -', r.column_name, ':', r.data_type));
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();
"
```

## Test 4: Query Conversion MySQL → PostgreSQL

Ce test vérifie que la conversion des placeholders fonctionne correctly.

```javascript
// Test the placeholder conversion
const { getPool } = require('./services/db')

async function testConversion() {
  const pool = getPool()
  
  try {
    // MySQL-style query with ? placeholders
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      ['test@example.com']
    )
    console.log('✅ Query conversion works!')
    console.log('Result:', rows.length, 'rows')
  } catch (err) {
    console.error('❌ Conversion failed:', err.message)
  }
}

testConversion()
```

## Troubleshooting

### "ECONNREFUSED"
- Supabase credentials incorrect
- Check DATABASE_URL value
- Verify Supabase SSL is accessible

### "Table does not exist"
- Run migrations in Supabase SQL Editor first
- Verify table names (case-sensitive in PostgreSQL)
- Check if you're in the right database

### "Permission denied"
- Database user doesn't have insert/update permissions
- Contact Supabase support to reset permissions

---

**Note**: Ces tests doivent passer après avoir exécuté `postgres_init.sql` sur Supabase.
