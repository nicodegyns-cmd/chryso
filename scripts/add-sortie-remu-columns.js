const { getPool } = require('../services/db')

async function migrate() {
  const pool = getPool()
  console.log('[Migration] Adding remuneration_sortie columns...')
  
  try {
    // Check if columns already exist
    const [res] = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'activities' AND column_name LIKE 'remuneration_sortie%'
    `)
    
    if (res && res.length > 0) {
      console.log('[Migration] Columns already exist:', res.map(r => r.column_name))
      return
    }
    
    // Add remuneration_sortie_infi column
    await pool.query(`
      ALTER TABLE activities 
      ADD COLUMN IF NOT EXISTS remuneration_sortie_infi NUMERIC(10,2) DEFAULT NULL
    `)
    console.log('[Migration] ✓ Added remuneration_sortie_infi column')
    
    // Add remuneration_sortie_med column
    await pool.query(`
      ALTER TABLE activities 
      ADD COLUMN IF NOT EXISTS remuneration_sortie_med NUMERIC(10,2) DEFAULT NULL
    `)
    console.log('[Migration] ✓ Added remuneration_sortie_med column')
    
    // Verify columns exist
    const [verify] = await pool.query(`
      SELECT id, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med 
      FROM activities LIMIT 1
    `)
    
    if (verify && verify.length > 0) {
      console.log('[Migration] ✓ Columns verified:')
      const col = verify[0]
      console.log('  - remuneration_infi:', col.remuneration_infi)
      console.log('  - remuneration_med:', col.remuneration_med)
      console.log('  - remuneration_sortie_infi:', col.remuneration_sortie_infi)
      console.log('  - remuneration_sortie_med:', col.remuneration_sortie_med)
    }
    
    console.log('[Migration] ✅ Done!')
    process.exit(0)
  } catch (err) {
    console.error('[Migration] ❌ Error:', err.message)
    process.exit(1)
  }
}

migrate()
