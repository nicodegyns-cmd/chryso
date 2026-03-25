// pages/api/documents.js
// Fetch user documents
// Protected endpoint - requires authentication

const { query } = require('../../services/db')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.query

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Find user by email
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(200).json({ documents: [] })
    }

    const userId = userResult.rows[0].id

    // Fetch documents for this user from the documents table
    // (table to be created in future migration)
    // For now, return empty list as structure is not yet defined
    
    return res.status(200).json({
      documents: [],
      message: 'Documents feature coming soon'
    })
  } catch (error) {
    console.error('Get documents error:', error)
    return res.status(500).json({ error: 'Failed to fetch documents' })
  }
}
