const fs = require('fs')
const path = require('path')
const db = require('../../../../services/db')

module.exports = async function handler(req, res) {
  try {
    // GET: Check if migration is applied
    if (req.method === 'GET') {
      try {
        const result = await db.query('SELECT 1 as test')
        
        // Try to query the column
        const columnCheck = await db.query(
          `SELECT COUNT(*) as found FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'invitation_token'`
        )
        
        const hasColumn = columnCheck.rows && columnCheck.rows.length > 0 && parseInt(columnCheck.rows[0].found) > 0
        
        return res.status(200).json({
          status: hasColumn ? 'APPLIED' : 'PENDING',
          message: hasColumn ? 'Migration is applied' : 'Migration needs to be applied'
        })
      } catch (err) {
        // If query fails, try basic connection test
        try {
          const pool = db.getPool()
          const testResult = await pool.execute('SELECT 1 as ok')
          return res.status(200).json({
            status: 'UNKNOWN',
            message: 'Could not check migration status: ' + err.message,
            hint: 'Try POST with valid token to apply migration'
          })
        } catch (e) {
          return res.status(500).json({
            error: 'Database connection failed',
            details: e.message
          })
        }
      }
    }

    // POST: Apply migration
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
    if (!token || token !== process.env.ADMIN_MIGRATION_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const sqlPath = path.join(process.cwd(), 'sql', '011_add_invitation_onboarding_columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    const statements = sql.split(';').filter(s => s.trim())

    let applied = 0, skipped = 0
    
    for (const stmt of statements) {
      try {
        await db.query(stmt.trim())
        applied++
      } catch (err) {
        if (err.code === '42701' || err.code === '42P07' || err.message.includes('already exists')) {
          skipped++
        } else {
          throw err
        }
      }
    }

    return res.status(200).json({ success: true, applied, skipped })
  } catch (err) {
    console.error('Migration error:', err)
    return res.status(500).json({ error: err.message })
  }
}
