const fs = require('fs')
const path = require('path')
const { query } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  // Allow both POST (requires token) and GET (for diagnostics)
  if (req.method === 'GET') {
    // Public diagnostic endpoint - no token required
    try {
      const result = await query(
        `SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN (
          'invitation_token',
          'invitation_sent_at',
          'invitation_expires_at',
          'onboarding_status',
          'import_batch_id'
        )`
      )

      const foundColumns = result.rows ? result.rows.map(r => r.column_name) : []
      const requiredColumns = [
        'invitation_token',
        'invitation_sent_at',
        'invitation_expires_at',
        'onboarding_status',
        'import_batch_id'
      ]
      const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c))

      return res.status(200).json({
        status: missingColumns.length === 0 ? 'APPLIED' : 'PENDING',
        foundColumns,
        missingColumns,
        message: missingColumns.length === 0 
          ? 'Migration 011 is already applied'
          : `Migration 011 needs to be applied. Missing columns: ${missingColumns.join(', ')}`
      })
    } catch (err) {
      console.error('Check migration error:', err)
      return res.status(500).json({
        error: 'Failed to check migration status',
        details: err.message
      })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET to check status or POST to apply.' })
  }

  // Verify admin token from query parameter or Authorization header
  const adminToken = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  const ADMIN_MIGRATION_TOKEN = process.env.ADMIN_MIGRATION_TOKEN

  if (!adminToken || adminToken !== ADMIN_MIGRATION_TOKEN) {
    return res.status(401).json({ 
      error: 'Unauthorized - invalid migration token',
      hint: 'Use: POST /api/admin/migrations/apply-011?token=YOUR_TOKEN'
    })
  }

  try {
    console.log('🔄 Applying migration 011: Add invitation and onboarding columns...')

    // Read the migration file
    const sqlPath = path.join(process.cwd(), 'sql', '011_add_invitation_onboarding_columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0)
    const results = []

    for (const statement of statements) {
      try {
        const trimmed = statement.trim()
        // Execute the statement
        await query(trimmed)
        results.push({
          status: 'success',
          statement: trimmed.slice(0, 60) + '...'
        })
        console.log('✅ Applied:', trimmed.slice(0, 60))
      } catch (err) {
        if (
          err.message.includes('already exists') ||
          err.code === '42701' || // column already exists
          err.code === '42P07' || // index already exists
          err.code === '42P10' // duplicate constraint
        ) {
          results.push({
            status: 'skipped',
            statement: statement.trim().slice(0, 60) + '...',
            reason: 'already exists'
          })
          console.log('⚠️  Skipped (already exists):', statement.trim().slice(0, 60))
        } else {
          throw err
        }
      }
    }

    console.log('✅ Migration 011 completed successfully!')
    return res.status(200).json({
      success: true,
      message: 'Migration 011 applied successfully',
      results
    })
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    return res.status(500).json({
      error: 'Migration failed',
      details: err.message
    })
  }
}
