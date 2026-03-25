const fs = require('fs')
const path = require('path')
const { getPool } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  try {
    // Check migration status via GET
    if (req.method === 'GET') {
      const pool = getPool()
      
      try {
        // Simple query to check if columns exist
        const result = await pool.query(
          `SELECT COUNT(*) as col_count FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'invitation_token'`
        )
        
        const hasColumn = result.rows && result.rows.length > 0 && result.rows[0].col_count > 0
        
        return res.status(200).json({
          status: hasColumn ? 'APPLIED' : 'PENDING',
          hasInvitationToken: hasColumn,
          message: hasColumn ? 'Migration 011 is applied' : 'Migration 011 needs to be applied'
        })
      } catch (err) {
        return res.status(500).json({
          error: 'Database check failed',
          details: err.message
        })
      }
    }

    // Apply migration via POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Use GET to check or POST to apply' })
    }

    const adminToken = req.query.token || req.headers.authorization?.replace('Bearer ', '')
    if (!adminToken || adminToken !== process.env.ADMIN_MIGRATION_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const pool = getPool()
    const sqlPath = path.join(process.cwd(), 'sql', '011_add_invitation_onboarding_columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    const statements = sql.split(';').filter(s => s.trim())
    let applied = 0
    let skipped = 0

    for (const statement of statements) {
      try {
        await pool.query(statement.trim())
        applied++
      } catch (err) {
        if (err.code === '42701' || err.code === '42P07' || err.message.includes('already exists')) {
          skipped++
        } else {
          throw err
        }
      }
    }

    return res.status(200).json({
      success: true,
      applied,
      skipped
    })
  } catch (err) {
    console.error('Migration error:', err)
    return res.status(500).json({
      error: err.message || 'Migration failed'
    })
  }
}
