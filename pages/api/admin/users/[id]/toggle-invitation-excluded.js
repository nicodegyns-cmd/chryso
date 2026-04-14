// pages/api/admin/users/[id]/toggle-invitation-excluded.js
import { getPool } from '../../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const pool = getPool()
  const { id } = req.query

  try {
    const q = await pool.query('SELECT invitation_excluded FROM users WHERE id = $1', [id])
    const rows = q.rows || q[0]
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' })

    const current = rows[0].invitation_excluded
    const next = !current

    await pool.query('UPDATE users SET invitation_excluded = $1 WHERE id = $2', [next, id])
    return res.status(200).json({ invitation_excluded: next })
  } catch (err) {
    console.error('[toggle-invitation-excluded]', err)
    return res.status(500).json({ error: err.message })
  }
}
