require('dotenv').config({ path: '.env.local' })
const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  
  // Check what columns exist on prestations
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'prestations' AND column_name LIKE 'validated%'
    ORDER BY column_name
  `)
  console.log('Validated columns:', cols.rows.map(r => r.column_name))

  // Check sample of validated prestations
  const r = await pool.query(`
    SELECT id, status, validated_at, validated_by_id, validated_by_email
    FROM prestations 
    WHERE status = 'Envoyé à la facturation'
    LIMIT 10
  `)
  console.log('\nSample validated prestations:')
  r.rows.forEach(p => console.log(`  id=${p.id} validated_at=${p.validated_at} by_id=${p.validated_by_id} by_email=${p.validated_by_email}`))

  // Check audit table if exists
  const audit = await pool.query(`
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') AS exists
  `)
  console.log('\nAudit table exists:', audit.rows[0].exists)
  
  if (audit.rows[0].exists) {
    const auditRows = await pool.query(`SELECT * FROM audit_log LIMIT 5`)
    console.log('Audit sample:', auditRows.rows)
  }

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
