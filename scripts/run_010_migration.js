const { getPool } = require('../services/db')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  const pool = getPool()
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../sql/010_add_sent_in_batch_to_prestations.sql'), 'utf8')
    const statements = sql.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      console.log('Executing:', statement.slice(0, 50) + '...')
      await pool.query(statement)
    }
    
    console.log('✅ Migration 010 completed successfully')
    process.exit(0)
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  }
}

runMigration()
