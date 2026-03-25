import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()

    // Check if documents table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'documents'
    `)

    const tableExists = tableCheck.rows && tableCheck.rows.length > 0

    if (!tableExists) {
      return res.status(500).json({
        success: false,
        error: 'Documents table does not exist',
        message: 'Run migration 014 first',
        tableExists: false
      })
    }

    // Check table structure
    const columnsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `)

    const requiredColumns = [
      'id', 'user_id', 'name', 'type', 'url', 'file_size',
      'validation_status', 'created_at'
    ]

    const existingColumns = (columnsCheck.rows || []).map(r => r.column_name)
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

    // Check specifically for validation columns
    const hasValidationStatus = existingColumns.includes('validation_status')
    const hasValidatedAt = existingColumns.includes('validated_at')

    return res.status(200).json({
      success: true,
      tableExists: true,
      totalColumns: columnsCheck.rows ? columnsCheck.rows.length : 0,
      columns: columnsCheck.rows || [],
      requiredColumns,
      existingColumns,
      missingColumns: missingColumns.length > 0 ? missingColumns : [],
      hasValidationStatus,
      hasValidatedAt,
      diagnosisOk: missingColumns.length === 0 && hasValidationStatus && hasValidatedAt
    })
  } catch (error) {
    console.error('Diagnosis error:', error)
    return res.status(500).json({
      success: false,
      error: 'Database check failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
