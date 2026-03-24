import db from '../../../services/db'
import crypto from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { rows } = req.body // rows = [{ email, first_name, last_name, role }, ...]
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid CSV data' })
    }

    const batchId = crypto.randomBytes(16).toString('hex')
    const created = []
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const email = (row.email || '').trim().toLowerCase()
      const firstName = (row.first_name || '').trim()
      const lastName = (row.last_name || '').trim()
      const role = (row.role || 'INFI').trim().toUpperCase() // default INFI

      // Validate
      if (!email || !email.includes('@')) {
        errors.push({ line: i + 2, reason: 'Invalid email' })
        continue
      }

      if (!firstName || !lastName) {
        errors.push({ line: i + 2, reason: 'Missing first_name or last_name' })
        continue
      }

      try {
        // Check if user already exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
        if (existing.rows.length > 0) {
          errors.push({ line: i + 2, reason: 'User already exists' })
          continue
        }

        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString('hex')
        const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

        // Create user with pending_signup status
        const result = await db.query(
          `INSERT INTO users (email, first_name, last_name, role, onboarding_status, invitation_token, invitation_sent_at, invitation_expires_at, import_batch_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, email, first_name, last_name, role, invitation_token, invitation_expires_at`,
          [email, firstName, lastName, role, 'pending_signup', invitationToken, new Date(), invitationExpiresAt, batchId, 1]
        )

        const user = result.rows[0]
        created.push({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          invitation_token: user.invitation_token,
          invitation_expires_at: user.invitation_expires_at
        })
      } catch (e) {
        console.error('User creation error:', e)
        errors.push({ line: i + 2, reason: e.message })
      }
    }

    res.status(200).json({
      batchId,
      summary: {
        total: rows.length,
        created: created.length,
        failed: errors.length
      },
      created,
      errors
    })
  } catch (error) {
    console.error('Bulk import error:', error)
    return res.status(500).json({ error: 'Failed to process bulk import' })
  }
}
