const { getPool } = require('../../../../../services/db')
const { sendUserCreationEmail } = require('../../../../../services/emailService')
const bcrypt = require('bcryptjs')

export default async function handler(req, res) {
  const pool = getPool()
  const { id } = req.query

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    // Get user details
    const [[user]] = await pool.query('SELECT id, email, first_name FROM users WHERE id = ? LIMIT 1', [id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Generate a new temporary password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
    let tempPassword = ''
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // Send welcome email with the temporary password
    const emailResult = await sendUserCreationEmail(user.email, tempPassword, user.first_name)
    
    if (!emailResult.sent) {
      return res.status(500).json({ error: emailResult.error || 'Erreur lors de l\'envoi de l\'email' })
    }

    // Hash the new password and update it in the database
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])

    return res.status(200).json({
      success: true,
      message: `Email de bienvenue renvoyé à ${user.email}`
    })
  } catch (err) {
    console.error('resend-welcome-email error', err)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
