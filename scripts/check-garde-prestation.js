const path = require('path')
const { getPool } = require(path.join(__dirname, '../services/db'))

async function check() {
  const pool = getPool()
  try {
    console.log('[Check] Structure de la table prestations:')
    const [columns] = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'prestations' 
       ORDER BY ordinal_position`
    )
    console.log(JSON.stringify(columns, null, 2))
    
    console.log('\n[Check] Une prestation Garde récente:')
    const [prestations] = await pool.query(
      `SELECT * FROM prestations 
       WHERE pay_type ILIKE '%Garde%' OR analytic_name ILIKE '%Garde%'
       ORDER BY created_at DESC
       LIMIT 3`
    )
    console.log(JSON.stringify(prestations, null, 2))
    
    process.exit(0)
  } catch(e) {
    console.error('[Check] Error:', e.message)
    process.exit(1)
  }
}

check()
