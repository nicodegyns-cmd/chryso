const { query } = require('../../../services/db')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { token, email, first_name, last_name, password, telephone, address, fonction, company } = req.body

    if (!token || !email || !first_name || !last_name || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate token
    const result = await query(
      `SELECT id FROM users 
       WHERE invitation_token = $1 AND invitation_expires_at > NOW() AND onboarding_status = $2`,
      [token, 'pending_signup']
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired token' })
    }

    const userId = result.rows[0].id

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Update user: set password, personal info, and mark as pending_validation
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           first_name = $2, 
           last_name = $3, 
           telephone = $4, 
           address = $5, 
           fonction = $6, 
           company = $7,
           onboarding_status = $8,
           invitation_token = NULL,
           invitation_sent_at = NULL,
           invitation_expires_at = NULL
       WHERE id = $9`,
      [passwordHash, first_name, last_name, telephone, address, fonction, company, 'pending_validation', userId]
    )

    res.status(200).json({ success: true, message: 'User data saved. Awaiting admin validation.' })
  } catch (error) {
    console.error('Complete signup error:', error)
    return res.status(500).json({ error: 'Failed to complete signup' })
  }
}
