const { Pool } = require('pg')
const pool = new Pool({
  host: 'ay177071-001.eu.clouddb.ovh.net',
  port: 35230,
  database: 'fenix',
  user: 'fenix',
  password: 'Toulouse94',
  ssl: { rejectUnauthorized: false }
})

async function run() {
  // Ensure column exists
  await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS hour_entry_type VARCHAR(20) DEFAULT NULL`)
  console.log('Column hour_entry_type ensured.')
  
  // Show current values
  const r = await pool.query(`SELECT id, analytic_id, pay_type, hour_entry_type FROM activities ORDER BY id`)
  console.log('Activities:')
  r.rows.forEach(row => {
    console.log(`  id=${row.id} analytic_id=${row.analytic_id} pay_type=${row.pay_type} hour_entry_type=${row.hour_entry_type}`)
  })
  await pool.end()
}
run().catch(e => { console.error(e); process.exit(1) })
