// Ensure documents.url column exists and populate URLs for existing rows
const mysql = require('mysql2/promise')

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'chryso' })
  try {
    console.log('Connected to DB')
    // Add url column if not exists
    await conn.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS url TEXT DEFAULT NULL")
    console.log('Ensured url column exists')

    // Populate url for rows where null
    const [res] = await conn.query("UPDATE documents SET url = CONCAT('/api/documents/serve?id=', id) WHERE url IS NULL")
    console.log('Populated URLs for', res.affectedRows, 'documents')
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

run()
