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
  // Show column names of the mappings table
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'activity_ebrigade_name_mappings'
    ORDER BY ordinal_position
  `)
  console.log('Columns in activity_ebrigade_name_mappings:', cols.rows.map(r => r.column_name))

  // Show all mappings with hour_entry_type
  const r = await pool.query(`
    SELECT nam.*, a.hour_entry_type, a.pay_type
    FROM activity_ebrigade_name_mappings nam
    LEFT JOIN activities a ON nam.activity_id = a.id
    ORDER BY nam.activity_id
  `)
  console.log('\nMappings with hour_entry_type:')
  r.rows.forEach(row => {
    const patternCol = Object.keys(row).find(k => k.includes('name') || k.includes('pattern'))
    console.log(JSON.stringify(row))
  })
  
  await pool.end()
}
run().catch(e => { console.error(e); process.exit(1) })
