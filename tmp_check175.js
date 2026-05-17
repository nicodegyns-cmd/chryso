require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
pool.query(
  'SELECT id, hours_actual, garde_hours, sortie_hours, overtime_hours, ebrigade_duration_hours, ebrigade_start_time, ebrigade_end_time, ebrigade_activity_name, ebrigade_id FROM prestations WHERE id=175'
).then(r => {
  console.log(JSON.stringify(r.rows[0], null, 2))
  pool.end()
}).catch(e => { console.error(e.message); pool.end() })
