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
    const [[user]] = await pool.query('SELECT id, email, first_name, invitation_excluded FROM users WHERE id = $1 LIMIT 1', [id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user is excluded from invitations
    if (user.invitation_excluded) {
      return res.status(403).json({ error: 'invitation_excluded', message: `${user.email} est exclu(e) des invitations. Désactivez l'exclusion dans la page Sécurité avant de renvoyer l'email.` })
    }

    // Check excluded_invitation_emails table too
    const excQ = await pool.query('SELECT 1 FROM excluded_invitation_emails WHERE LOWER(email) = LOWER($1) LIMIT 1', [user.email])
    const excRows = excQ.rows || excQ[0] || []
    if (excRows.length > 0) {
      return res.status(403).json({ error: 'invitation_excluded', message: `${user.email} est dans la liste d'exclusion des invitations. Retirez-le de la liste dans la page Sécurité avant de renvoyer l'email.` })
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

    // Hash the new password and update it in the database. Mark user as needing to complete profile.
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1, must_complete_profile = true, accepted_cgu = false, accepted_privacy = false WHERE id = $2', [passwordHash, id])

    return res.status(200).json({
      success: true,
      message: `Email de bienvenue renvoyé à ${user.email}`
    })
  } catch (err) {
    console.error('resend-welcome-email error', err)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
