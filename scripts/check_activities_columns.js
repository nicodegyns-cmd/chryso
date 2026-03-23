const { getPool } = require('../services/db')

async function checkActivitiesTable() {
  const pool = getPool()
  try {
    console.log('🔍 Checking activities table structure...\n')
    
    // Try to get column information
    const [columns] = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'activities'
      ORDER BY ordinal_position
    `)
    
    console.log('📋 Activities table columns:')
    if (Array.isArray(columns) && columns.length > 0) {
      columns.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? '[NULL]' : '[NOT NULL]'}`)
      })
    } else {
      console.log('  No columns found or query failed')
    }
    
    console.log('\n📊 Getting sample data:')
    const [rows] = await pool.query('SELECT * FROM activities LIMIT 3')
    console.log(`Found ${rows.length} activities`)
    if (rows.length > 0) {
      console.log('Sample activity:', JSON.stringify(rows[0], null, 2))
    }
    
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error('Full error:', err)
    process.exit(1)
  }
}

checkActivitiesTable()
