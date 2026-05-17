require('dotenv').config({ path: '.env.local' })
const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  
  // Check available date columns on prestations
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'prestations' AND (column_name LIKE '%date%' OR column_name LIKE '%at%' OR column_name LIKE '%time%')
    ORDER BY column_name
  `)
  console.log('Date-related columns:', cols.rows.map(r => r.column_name))

  // Sample data with date fields
  const r = await pool.query(`
    SELECT id, status, date, created_at, updated_at
    FROM prestations 
    WHERE status = 'Envoyé à la facturation'
    LIMIT 5
  `)
  console.log('\nSample:')
  r.rows.forEach(p => console.log(`  id=${p.id} date=${p.date} created_at=${p.created_at} updated_at=${p.updated_at}`))

  process.exit(0)
}
main().catch(e => { console.error(e.message); process.exit(1) })
