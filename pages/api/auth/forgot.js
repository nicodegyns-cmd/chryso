import crypto from 'crypto'
import { getPool } from '../../../services/db'
import { sendPasswordResetEmail } from '../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const pool = getPool()

  try {
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const userQuery = 'SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = $1'
    const userResult = await pool.query(userQuery, [normalizedEmail])
    
    if (userResult.rows.length === 0) {
      // Return generic message to avoid account enumeration
      return res.status(200).json({ message: "Si l'adresse existe, un email de réinitialisation a été envoyé." })
    }

    const user = userResult.rows[0]

    // Generate reset token (64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const sentAt = new Date()

    // Save token to database
    const updateQuery = `
      UPDATE users 
      SET password_reset_token = $1, password_reset_sent_at = $2
      WHERE id = $3
      RETURNING id, email, first_name, last_name
    `
    await pool.query(updateQuery, [resetToken, sentAt, user.id])

    // Send password reset email
    const resetLink = `${process.env.APP_URL || 'https://fenix.nexio7.be'}/reset-password?token=${resetToken}`
    await sendPasswordResetEmail({
      to: user.email,
      userName: user.first_name || user.email,
      resetLink
    })

    console.log('[forgot.js] Password reset email sent to:', user.email)

    return res.status(200).json({ 
      message: "Si l'adresse existe, un email de réinitialisation a été envoyé.",
      success: true 
    })
  } catch (err) {
    console.error('[forgot.js] Error:', err)
    return res.status(500).json({ error: 'Erreur serveur lors de la demande de réinitialisation' })
  }
}
