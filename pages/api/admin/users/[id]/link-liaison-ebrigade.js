const { getPool } = require('../../../../../services/db')

/**
 * POST endpoint to link a user's liaison_ebrigade_id
 * Body: { liaison_ebrigade_id: "..." }
 * Links the current user (from route [id]) to an eBrigade profile
 */
export default async function handler(req, res) {
  const pool = getPool()
  const { id } = req.query

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const { liaison_ebrigade_id } = req.body || {}

  if (!liaison_ebrigade_id) {
    return res.status(400).json({ error: 'missing_liaison_ebrigade_id' })
  }

  try {
    // Update the user's liaison_ebrigade_id
    const [result] = await pool.query(
      'UPDATE users SET liaison_ebrigade_id = ? WHERE id = ?',
      [liaison_ebrigade_id, id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'user_not_found' })
    }

    // Return the updated user info
    const [[user]] = await pool.query(
      'SELECT id, email, first_name, last_name, liaison_ebrigade_id FROM users WHERE id = ? LIMIT 1',
      [id]
    )

    console.log('[api/admin/users/[id]/link-liaison-ebrigade] Linked user:', {
      user_id: id,
      liaison_ebrigade_id
    })

    return res.status(200).json({
      success: true,
      message: `Utilisateur lié à eBrigade (ID: ${liaison_ebrigade_id})`,
      user
    })
  } catch (err) {
    console.error('[api/admin/users/[id]/link-liaison-ebrigade] error', err)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
