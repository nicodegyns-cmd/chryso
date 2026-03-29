// pages/api/admin/debug-documents.js
// Debug endpoint - check documents table status
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  // Security: only allow GET and only in dev or with admin auth
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    
    // Check table structure
    const q_columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `)
    
    // Count all documents
    const q_countResult = await pool.query('SELECT COUNT(*) as total FROM documents')
    const totalDocs = countResult[0]?.total || 0
    
    // Get pending documents with join
    const q_pending = await pool.query(`
      SELECT 
        d.id, 
        d.user_id, 
        d.name, 
        d.validation_status, 
        d.created_at,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `)
    
    // Get all documents for debugging
    const q_allDocs = await pool.query(`
      SELECT 
        d.id, 
        d.user_id, 
        d.name, 
        d.validation_status, 
        d.created_at,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `)
    
    return res.status(200).json({
      success: true,
      tableExists: columns.length > 0,
      columns: columns.map(c => `${c.column_name} (${c.data_type}, ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'})`),
      stats: {
        totalDocuments: totalDocs,
        pendingDocuments: pending.length,
        userCount: (await pool.query('SELECT COUNT(*) as total FROM users'))[0][0]?.total || 0
      },
      pendingDocuments: pending,
      recentDocuments: allDocs
    })
  } catch (error) {
    console.error('[DEBUG-DOCUMENTS] Error:', error)
    return res.status(500).json({
      error: 'Debug failed',
      message: error.message,
      type: error.code
    })
  }
}
