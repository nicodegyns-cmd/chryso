// pages/api/documents.js
// Fetch user documents
// Protected endpoint - requires authentication

import { getPool } from '../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.query

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const pool = getPool()

    // Find user by email
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (!userRows || userRows.length === 0) {
      return res.status(200).json({ documents: [] })
    }

    const userId = userRows[0].id

    // Fetch documents for this user from the documents table
    const [docRows] = await pool.query(
      `SELECT 
        id,
        name,
        type,
        url,
        file_size,
        created_at,
        validation_status,
        rejection_reason
      FROM documents 
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [userId]
    )
    
    return res.status(200).json({
      success: true,
      documents: docRows || []
    })
  } catch (error) {
    console.error('Get documents error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error.message
    })
  }
}
