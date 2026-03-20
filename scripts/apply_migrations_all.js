const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run() {
  const pool = getPool()
  const dir = path.join(__dirname, '..', 'sql')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  console.log('Found SQL files:', files)

  for (const file of files) {
    const full = path.join(dir, file)
    console.log('\n--- Running', file)
    let sql = fs.readFileSync(full, 'utf8')
    // remove full-line comments starting with --
    sql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    // naive split by semicolon -- good enough for our migration files
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (e) {
        // log but continue
        console.error(`Statement error (${file}):`, e.message)
      }
    }
    console.log('Finished', file)
  }

  console.log('\nAll migration files processed (errors logged if any).')
  process.exit(0)
}

run()
