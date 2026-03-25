import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database pool not initialized',
        details: 'Failed to get database connection'
      })
    }

    // Check if documents table exists
    let tableRows
    try {
      // pool.query() returns [rows, fields]
      const [rows] = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'documents'
      `)
      tableRows = rows
    } catch (err) {
      console.error('Table check query error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to check if documents table exists',
        details: err.message
      })
    }

    const tableExists = tableRows && tableRows.length > 0

    if (!tableExists) {
      return res.status(200).json({
        success: true,
        tableExists: false,
        error: 'Documents table does not exist',
        message: 'Run migration 014 first - CREATE TABLE documents',
        recommendation: 'Execute: sql/014_create_documents_table.sql'
      })
    }

    // Check table structure
    let columnRows
    try {
      // pool.query() returns [rows, fields]
      const [rows] = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'documents'
        ORDER BY ordinal_position
      `)
      columnRows = rows
    } catch (err) {
      console.error('Columns check query error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to check table columns',
        details: err.message
      })
    }

    const requiredColumns = [
      'id', 'user_id', 'name', 'type', 'url', 'file_size',
      'validation_status', 'created_at'
    ]

    const existingColumns = (columnRows && columnRows.length > 0) ? columnRows.map(r => r.column_name) : []
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

    // Check specifically for validation columns
    const hasValidationStatus = existingColumns.includes('validation_status')
    const hasValidatedAt = existingColumns.includes('validated_at')

    return res.status(200).json({
      success: true,
      tableExists: true,
      totalColumns: columnRows ? columnRows.length : 0,
      columns: columnRows || [],
      requiredColumns,
      existingColumns,
      missingColumns: missingColumns.length > 0 ? missingColumns : [],
      hasValidationStatus,
      hasValidatedAt,
      diagnosisOk: missingColumns.length === 0 && hasValidationStatus && hasValidatedAt,
      recommendation: hasValidationStatus ? '✅ All required columns present - upload should work' : '❌ Missing validation columns - Run migration 015'
    })
  } catch (error) {
    console.error('Diagnosis error:', error)
    return res.status(500).json({
      success: false,
      error: 'Database diagnostic failed',
      details: error.message || 'Unknown error',
      type: error.name
    })
  }
}
