const { getPool } = require('../../../../../services/db')

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
    await pool.query(
      'UPDATE users SET liaison_ebrigade_id = $1 WHERE id = $2',
      [liaison_ebrigade_id, id]
    )

    const userQuery = await pool.query(
      'SELECT id, email, first_name, last_name, liaison_ebrigade_id FROM users WHERE id = $1 LIMIT 1',
      [id]
    )
    const user = (userQuery && userQuery.rows) ? userQuery.rows[0] : null

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' })
    }

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
