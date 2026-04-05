const { getPool } = require('./services/db')

async function createMappings() {
  const pool = getPool()
  try {
    console.log('Creating mappings for Ambulance (723033)...')
    
    // Check existing
    const [existing] = await pool.query(
      `SELECT * FROM activity_ebrigade_mappings WHERE ebrigade_analytic_name LIKE '%723033%'`
    )
    console.log('Existing mappings:', existing.length)
    
    // Create for both activities
    const [mapping1]  = await pool.query(
      `INSERT INTO activity_ebrigade_mappings (ebrigade_analytic_name, activity_id)
       VALUES ('723033', 4)  -- Permanence activity for Ambulance
       RETURNING *`
    )
    console.log('✓ Created mapping for 723033 → Activity 4 (Permanence)')
    
    const [mapping2] = await pool.query(
      `INSERT INTO activity_ebrigade_mappings (ebrigade_analytic_name, activity_id)
       VALUES ('723033/MED', 5)  -- Garde activity for Ambulance
       RETURNING *`
    )
    console.log('✓ Created mapping for 723033/MED → Activity 5 (Garde)')
    
    // Verify
    const [final] = await pool.query(
      `SELECT * FROM activity_ebrigade_mappings WHERE ebrigade_analytic_name LIKE '%723033%'`
    )
    console.log('\nVerification - Total mappings now:', final.length)
    console.log(JSON.stringify(final, null, 2))
    
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

createMappings()
