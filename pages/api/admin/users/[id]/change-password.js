const bcrypt = require('bcryptjs')
const { getPool } = require('../../../../../services/db')
const { sendPasswordChangeEmail } = require('../../../../../services/emailService')

export default async function handler(req, res) {
  const { id } = req.query
  const { oldPassword, newPassword } = req.body || {}

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const pool = getPool()

  try {
    // Fetch user by id
    const [rows] = await pool.query('SELECT id, email, password_hash, first_name FROM users WHERE id = ?', [id])
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = rows[0]

    // Verify old password
    if (!user.password_hash) {
      return res.status(400).json({ error: 'No password set for this user' })
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Old password is incorrect' })
    }

    // Hash new password
    const saltRounds = 10
    const newHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password in database
    await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newHash, id])

    // Send confirmation email
    const emailResult = await sendPasswordChangeEmail(user.email, user.first_name)
    console.log('[api/admin/users/[id]/change-password] Password changed for user:', { id, email: user.email })

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      emailSent: emailResult.sent,
    })
  } catch (err) {
    console.error('[api/admin/users/[id]/change-password] error', err)
    return res.status(500).json({ error: 'db_error', detail: err.message })
  }
}
