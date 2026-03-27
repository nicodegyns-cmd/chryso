const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run() {
  const pool = getPool()
  const sqlDir = path.join(__dirname, '..', 'sql')
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort()

  try {
    for (const file of files) {
      const sqlPath = path.join(sqlDir, file)
      let sql = fs.readFileSync(sqlPath, 'utf8')

      // Remove backticks (MySQL identifier quoting) to avoid immediate syntax errors
      sql = sql.replace(/`/g, '')

      // Remove lines that are full-line comments starting with --
      sql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

      // Split statements on semicolon
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

      console.log(`Running file: ${file} (${statements.length} statements)`)

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        const short = stmt.length > 200 ? stmt.slice(0, 200) + '...' : stmt
        console.log(`  Executing ${file} statement ${i + 1}/${statements.length}: ${short}`)
        try {
          await pool.query(stmt)
        } catch (e) {
          console.error(`Error in file ${file} statement ${i + 1}:`, e && e.message ? e.message : e)
          console.error('Full statement:\n', stmt)
          await pool.end()
          process.exit(1)
        }
      }
    }

    console.log('Migrations applied (all files).')
    await pool.end()
    process.exit(0)
  } catch (err) {
    console.error('Migration runner failed', err)
    try { await pool.end() } catch (_) {}
    process.exit(1)
  }
}

run()
