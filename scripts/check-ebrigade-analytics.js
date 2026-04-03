const path = require('path')
const { getPool } = require(path.join(__dirname, '../services/db'))

async function check() {
  const pool = getPool()
  try {
    console.log('[Check] Tout les analytiques eBrigade uniques:')
    const [analytics] = await pool.query(
      `SELECT DISTINCT E_LIBELLE, E_CODE 
       FROM prestations 
       WHERE E_LIBELLE IS NOT NULL 
       ORDER BY E_LIBELLE
       LIMIT 50`
    )
    console.log(JSON.stringify(analytics, null, 2))
    
    console.log('\n[Check] Ceux qui contiennent "Garde":')
    const [garde] = await pool.query(
      `SELECT DISTINCT E_LIBELLE, E_CODE 
       FROM prestations 
       WHERE E_LIBELLE ILIKE '%Garde%'
       ORDER BY E_LIBELLE
       LIMIT 50`
    )
    console.log(JSON.stringify(garde, null, 2))
    
    process.exit(0)
  } catch(e) {
    console.error('[Check] Error:', e.message)
    process.exit(1)
  }
}

check()
