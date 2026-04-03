const path = require('path')
const { getPool } = require(path.join(__dirname, '../services/db'))

async function check() {
  const pool = getPool()
  try {
    console.log('[Check] Activities with Garde type or id=5:')
    const [activities] = await pool.query(
      `SELECT id, analytic_name, pay_type, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med 
       FROM activities 
       WHERE pay_type = $1 OR id = 5 
       ORDER BY id`,
      ['Garde']
    )
    console.log(JSON.stringify(activities, null, 2))
    
    console.log('\n[Check] eBrigade mappings for activity_id=5:')
    const [mappings] = await pool.query(
      'SELECT activity_id, ebrigade_analytic_name_pattern FROM activity_ebrigade_name_mappings WHERE activity_id = 5'
    )
    console.log(JSON.stringify(mappings, null, 2))
    
    console.log('\n[Check] All activities:')
    const [all] = await pool.query('SELECT id, analytic_name, pay_type FROM activities')
    console.log(JSON.stringify(all, null, 2))
    
    process.exit(0)
  } catch(e) {
    console.error('[Check] Error:', e.message)
    process.exit(1)
  }
}

check()
