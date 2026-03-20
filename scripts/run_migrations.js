const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run() {
  const pool = getPool()
  const sqlPath = path.join(__dirname, '..', 'sql', '004_create_prestations_table.sql')
  let sql = fs.readFileSync(sqlPath, 'utf8')
  // Remove lines that are full-line comments starting with --
  sql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
  // Split statements on semicolon
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
  try {
    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (e) {
        // ignore errors for statements that are not executable
        console.error('Statement error:', e.message)
      }
    }
    console.log('Migrations applied (attempted).')
    process.exit(0)
  } catch (err) {
    console.error('Migration runner failed', err)
    process.exit(1)
  }
}

run()
