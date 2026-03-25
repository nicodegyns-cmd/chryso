// pages/api/admin/diagnostics/check-migrations.js
// Check which migrations have been applied to the database
// Public endpoint for diagnostics

const { query } = require('../../../../services/db')

export default async function handler(req, res) {
  try {
    // Check which columns exist
    const columnsCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY column_name
    `)

    const columns = columnsCheck.rows.map(r => r.column_name)
    
    // Check specific columns we need for invitations
    const requiredColumns = [
      'invitation_token',
      'invitation_sent_at', 
      'invitation_expires_at',
      'onboarding_status',
      'import_batch_id'
    ]

    const missingColumns = requiredColumns.filter(col => !columns.includes(col))
    const presentColumns = requiredColumns.filter(col => columns.includes(col))

    // Check indexes
    const indexesCheck = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users'
      ORDER BY indexname
    `)

    const indexes = indexesCheck.rows.map(r => r.indexname)
    const requiredIndexes = [
      'idx_invitation_token',
      'idx_onboarding_status',
      'idx_import_batch'
    ]
    const missingIndexes = requiredIndexes.filter(idx => !indexes.includes(idx))

    const allColumnsPresent = missingColumns.length === 0

    return res.status(200).json({
      status: allColumnsPresent ? 'READY' : 'MIGRATION_NEEDED',
      timestamp: new Date().toISOString(),
      database: {
        totalColumns: columns.length,
        invitationColumns: {
          required: requiredColumns.length,
          present: presentColumns.length,
          missing: missingColumns,
          presentColumns: presentColumns
        },
        indexes: {
          required: requiredIndexes.length,
          present: requiredIndexes.length - missingIndexes.length,
          missing: missingIndexes
        }
      },
      recommendations: [
        !allColumnsPresent && 'Apply migration 011: Add invitation columns',
        missingIndexes.length > 0 && 'Create missing indexes',
        allColumnsPresent && '✅ Database is ready for invitations'
      ].filter(Boolean)
    })
  } catch (err) {
    console.error('Check migrations error:', err)
    return res.status(500).json({
      error: 'Failed to check migrations',
      details: err.message
    })
  }
}
