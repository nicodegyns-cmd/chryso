const fs = require('fs')
const path = require('path')

// Import the db module - it exports both getPool and query
const { getPool } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  // Simple GET to check status
  if (req.method === 'GET') {
    try {
      // Use getPool().execute() which is the MySQL-compatible interface
      const pool = getPool()
      const result = await pool.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'prestations' AND column_name = 'validated_at' LIMIT 1"
      )
      
      const exists = result.rows && result.rows.length > 0
      
      return res.status(200).json({
        status: exists ? 'APPLIED' : 'PENDING',
        columnExists: exists
      })
    } catch (err) {
      console.error('Check error:', err.message)
      return res.status(200).json({
        status: 'ERROR',
        message: err.message,
        hint: 'Check that database is connected'
      })
    }
  }

  // POST to apply migration
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token || token !== process.env.ADMIN_MIGRATION_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const pool = getPool()
    const sqlPath = path.join(process.cwd(), 'sql', '021_add_validation_columns_to_prestations.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    const statements = sql.split(';').filter(s => s.trim().length > 0)
    let applied = 0, skipped = 0
    
    for (const statement of statements) {
      try {
        await pool.execute(statement.trim())
        applied++
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || err.code === '42701' || err.code === '42P07') {
          skipped++
        } else {
          console.error('Statement error:', statement.slice(0, 50), err.message)
          throw err
        }
      }
    }

    return res.status(200).json({
      success: true,
      applied,
      skipped,
      total: statements.length,
      message: 'Migration 021 (add validation columns to prestations) applied successfully'
    })
  } catch (err) {
    console.error('Migration apply error:', err)
    return res.status(500).json({
      error: 'Failed to apply migration',
      message: err.message
    })
  }
}
