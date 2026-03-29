// pages/api/admin/add-file-data-column.js
// Add file_data column to documents table if it doesn't exist

import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()

    // Check if column exists
    const q_columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'documents' AND column_name = 'file_data'
    `)

    if (columns.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'file_data column already exists'
      })
    }

    // Add the column
    await pool.query(`
      ALTER TABLE documents ADD COLUMN file_data BYTEA
    `)

    return res.status(200).json({
      success: true,
      message: 'file_data column added successfully'
    })
  } catch (error) {
    console.error('[ADD-COLUMN] Error:', error)
    return res.status(500).json({
      error: 'Failed to add column',
      details: error.message
    })
  }
}
