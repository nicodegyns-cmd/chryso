const { getPool } = require('../services/db')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  const pool = getPool()
  try {
    console.log('Running Migration 012: Remove UNIQUE constraint on analytics.code')
    
    const sql = fs.readFileSync(path.join(__dirname, '../sql/012_remove_code_unique_constraint.sql'), 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 80) + '...')
      await pool.query(statement)
    }
    
    console.log('✅ Migration 012 completed successfully')
    process.exit(0)
  } catch (err) {
    console.error('❌ Migration 012 failed:', err.message)
    process.exit(1)
  }
}

runMigration()
