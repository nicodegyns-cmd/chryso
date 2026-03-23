const { getPool } = require('../services/db')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  const pool = getPool()
  try {
    console.log('🚀 Running Migration 013: Add explicit eBrigade activity type mapping')
    
    const sql = fs.readFileSync(path.join(__dirname, '../sql/013_add_ebrigade_activity_type_to_activities.sql'), 'utf8')
    
    // Split by semicolon and execute each statement separately
    const statements = sql.split(';').map(s => s.trim()).filter(s => !s.startsWith('--') && s.length > 0)
    
    for (const statement of statements) {
      console.log('📝 Executing:', statement.substring(0, 80) + (statement.length > 80 ? '...' : ''))
      try {
        await pool.query(statement)
      } catch (err) {
        if (err.code === '42701' || err.message.includes('already exists')) {
          console.log('   ℹ️  (Column/index already exists - skipping)')
        } else {
          throw err
        }
      }
    }
    
    console.log('✅ Migration 013 completed successfully!')
    console.log('✓ Added ebrigade_activity_type column to activities table')
    console.log('✓ Created index on ebrigade_activity_type for fast lookups')
    console.log('\n📌 Changes:')
    console.log('  - Activities now have an explicit eBrigade type mapping field')
    console.log('  - Admin can select activity type from dropdown when creating activities')
    console.log('  - API will use this field to match eBrigade participations')
    process.exit(0)
  } catch (err) {
    console.error('❌ Migration 013 failed:', err.message)
    console.error(err)
    process.exit(1)
  }
}

runMigration()
