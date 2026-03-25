import { getPool } from '../../../../services/db'
import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.body

  // Verify admin token
  if (token !== process.env.ADMIN_MIGRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const pool = getPool()

    // Apply migration 014 - Create documents table
    console.log('Applying migration 014...')
    const migration014Path = path.join(process.cwd(), 'sql', '014_create_documents_table.sql')
    const migration014 = fs.readFileSync(migration014Path, 'utf-8')
    
    try {
      await pool.query(migration014)
      console.log('✅ Migration 014 applied')
    } catch (err) {
      console.log('Migration 014 already exists or error:', err.message)
    }

    // Apply migration 015 - Add validation columns
    console.log('Applying migration 015...')
    const migration015Path = path.join(process.cwd(), 'sql', '015_add_document_validation_status.sql')
    const migration015 = fs.readFileSync(migration015Path, 'utf-8')
    
    try {
      await pool.query(migration015)
      console.log('✅ Migration 015 applied')
    } catch (err) {
      console.log('Migration 015 already exists or error:', err.message)
    }

    // Verify tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('documents')
    `)

    if (tablesCheck.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Migrations applied but documents table not found',
        details: 'Check database connection'
      })
    }

    // Check if validation columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'documents' AND column_name IN ('validation_status', 'validated_at')
    `)

    return res.status(200).json({
      success: true,
      message: 'Migrations 014 and 015 applied successfully',
      documentTableExists: true,
      validationColumnsExist: columnsCheck.rows.length === 2,
      columnsFound: columnsCheck.rows.map(r => r.column_name)
    })
  } catch (error) {
    console.error('Migration error:', error)
    return res.status(500).json({ 
      error: 'Failed to apply migrations',
      details: error.message
    })
  }
}
