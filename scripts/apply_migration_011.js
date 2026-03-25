const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// Load environment variables
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL

async function applyMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔄 Applying migration 011: Add invitation and onboarding columns...')
    
    const sqlPath = path.join(__dirname, '..', 'sql', '011_add_invitation_onboarding_columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0)
    
    for (const statement of statements) {
      try {
        const result = await pool.query(statement)
        console.log('✅', statement.slice(0, 50) + '...')
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('⚠️  (Column already exists, skipping)')
        } else {
          throw err
        }
      }
    }
    
    console.log('\n✅ Migration 011 applied successfully!')
    await pool.end()
    process.exit(0)
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    await pool.end()
    process.exit(1)
  }
}

applyMigration()
