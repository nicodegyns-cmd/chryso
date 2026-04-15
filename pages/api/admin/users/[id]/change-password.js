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
    // Exception: internal roles (admin/moderator/comptabilite) skip CGU and are already active
    const [userCheck] = await pool.query('SELECT accepted_cgu, accepted_privacy, role FROM users WHERE id = $1', [id])
    if (userCheck && userCheck.length > 0) {
      const u = userCheck[0]
      const internalRoles = ['admin', 'moderator', 'comptabilite']
      const isInternal = (u.role || '').split(',').some(r => internalRoles.includes(r.trim()))
      if (isInternal) {
        // Internal roles: just clear must_complete_profile, stay active
        await pool.query(
          'UPDATE users SET must_complete_profile = $1 WHERE id = $2',
          [false, id]
        )
      } else if (u.accepted_cgu && u.accepted_privacy) {
        // Standard roles: complete onboarding → pending_validation
        await pool.query(
          'UPDATE users SET onboarding_status = $1, must_complete_profile = $2, is_active = $3 WHERE id = $4',
          ['pending_validation', 0, 0, id]
        )
      }
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    console.error('[api/admin/users/[id]/change-password] error', err)
    return res.status(500).json({ error: 'db_error', detail: err.message })
  }
}
