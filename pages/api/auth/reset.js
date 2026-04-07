import bcrypt from 'bcryptjs'
import { getPool } from '../../../services/db'
import { sendPasswordChangeEmail } from '../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, password, passwordConfirm } = req.body || {}

  if (!token || !password || !passwordConfirm) {
    return res.status(400).json({ error: 'Token and passwords are required' })
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' })
  }

  const pool = getPool()

  try {
    console.log('[reset.js] Attempting password reset with token:', token.substring(0, 10) + '...')
    
    // Find user by reset token
    const userQuery = `
      SELECT id, email, first_name, password_reset_token, password_reset_sent_at 
      FROM users 
      WHERE password_reset_token = $1
    `
    const userResult = await pool.query(userQuery, [token])
    console.log('[reset.js] Found users with token:', userResult.rows.length)

    if (userResult.rows.length === 0) {
      console.log('[reset.js] No user found with token:', token.substring(0, 10) + '...')
      return res.status(404).json({ error: 'Token de réinitialisation invalide ou expiré' })
    }

    const user = userResult.rows[0]

    // Check if token is not expired (24 hours)
    if (user.password_reset_sent_at) {
      const sentAtTime = new Date(user.password_reset_sent_at).getTime()
      const nowTime = new Date().getTime()
      const expiryTime = 24 * 60 * 60 * 1000 // 24 hours
      
      if (nowTime - sentAtTime > expiryTime) {
        return res.status(400).json({ error: 'Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.' })
      }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update password and clear reset token
    const updateQuery = `
      UPDATE users
      SET password_hash = $1, password_reset_token = NULL, password_reset_sent_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, first_name
    `
    const updateResult = await pool.query(updateQuery, [passwordHash, user.id])

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe' })
    }

    const updatedUser = updateResult.rows[0]

    // Send confirmation email
    try {
      await sendPasswordChangeEmail(updatedUser.email, updatedUser.first_name || 'Utilisateur')
    } catch (emailErr) {
      console.error('[reset.js] Error sending confirmation email:', emailErr.message)
      // Don't fail the request if email fails, just log it
    }

    console.log('[reset.js] Password reset successful for user:', user.id)

    return res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    })
  } catch (err) {
    console.error('[reset.js] Error:', err)
    return res.status(500).json({ error: 'Erreur serveur lors de la réinitialisation' })
  }
}
