const path = require('path')
const { getPool } = require(path.join(__dirname, '../services/db'))

async function debug() {
  const pool = getPool()
  try {
    console.log('[DEBUG] Testing extract function:')
    
    // Test the extraction function
    const extractNamePrefix = (name) => {
      if (!name) return null
      const match = name.match(/^([^-|]+?)(?:\s*[-|]|\s*$)/)
      return match ? match[1].trim() : name.trim()
    }
    
    // Test cases
    const testNames = [
      'Garde',
      'Garde | 14h-21h',
      'Garde - 14h-21h',
      'Permanence INFI',
      'Permanence INFI | 07h-14h',
      'Ambulance',
      'Ambulance - Sortie'
    ]
    
    console.log('\nExtraction tests:')
    testNames.forEach(name => {
      const prefix = extractNamePrefix(name)
      console.log(`  "${name}" → "${prefix}"`)
    })
    
    console.log('\n[DEBUG] Database mappings:')
    const [mappings] = await pool.query(
      'SELECT activity_id, ebrigade_analytic_name_pattern FROM activity_ebrigade_name_mappings ORDER BY activity_id'
    )
    console.log(JSON.stringify(mappings, null, 2))
    
    console.log('\n[DEBUG] Test lookup for "Garde":')
    const [results] = await pool.query(
      `SELECT DISTINCT a.id, a.pay_type, a.remuneration_infi, a.remuneration_med, a.remuneration_sortie_infi, a.remuneration_sortie_med
       FROM activities a
       INNER JOIN activity_ebrigade_name_mappings am ON a.id = am.activity_id
       WHERE am.ebrigade_analytic_name_pattern = $1`,
      ['Garde']
    )
    console.log('Results:', JSON.stringify(results, null, 2))
    
    process.exit(0)
  } catch(e) {
    console.error('[DEBUG] Error:', e.message)
    process.exit(1)
  }
}

debug()
