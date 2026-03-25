import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()

    // Check if documents table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'documents'
      )
    `)

    const tableExists = tableCheck.rows[0].exists

    if (!tableExists) {
      return res.status(500).json({
        success: false,
        error: 'Documents table does not exist',
        message: 'Run migrations 014 and 015 first'
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
      'id', 'user_id', 'name', 'type', 'url', 'file_path', 'file_size',
      'validation_status', 'created_at'
    ]

    const existingColumns = columnsCheck.rows.map(r => r.column_name)
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

    return res.status(200).json({
      success: true,
      tableExists: true,
      totalColumns: columnsCheck.rows.length,
      columns: columnsCheck.rows,
      requiredColumns,
      missingColumns: missingColumns.length > 0 ? missingColumns : [],
      diagnosisOk: missingColumns.length === 0
    })
  } catch (error) {
    console.error('Diagnosis error:', error)
    return res.status(500).json({
      success: false,
      error: 'Database check failed',
      details: error.message
    })
  }
}
