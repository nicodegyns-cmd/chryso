const bcrypt = require('bcryptjs')
const { getPool } = require('../../../../../services/db')

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
    const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [id])
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
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, id])

    // After password change, check if both CGU and privacy were accepted
    // If yes, complete the onboarding and move to pending validation
    const [userCheck] = await pool.query('SELECT accepted_cgu, accepted_privacy FROM users WHERE id = $1', [id])
    if (userCheck && userCheck.length > 0) {
      const u = userCheck[0]
      if (u.accepted_cgu && u.accepted_privacy) {
        // Mark onboarding as complete
        await pool.query(
          'UPDATE users SET onboarding_status = $1, must_complete_profile = $2 WHERE id = $3',
          ['pending_validation', false, id]
        )
      }
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    console.error('[api/admin/users/[id]/change-password] error', err)
    return res.status(500).json({ error: 'db_error', detail: err.message })
  }
}
