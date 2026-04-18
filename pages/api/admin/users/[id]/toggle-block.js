import { getPool } from '../../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  const pool = getPool()

  try {
    const q = await pool.query('SELECT is_active, onboarding_status FROM users WHERE id = $1', [id])
    const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' })

    const user = rows[0]
    const isBlocked = user.is_active == 0 && user.onboarding_status === 'blocked'

    if (isBlocked) {
      // Unblock: restore to active
      await pool.query(
        "UPDATE users SET is_active = 1, onboarding_status = 'active' WHERE id = $1",
        [id]
      )
      return res.status(200).json({ success: true, action: 'unblocked' })
    } else {
      // Block: deactivate and mark as blocked (preserves all data including password)
      await pool.query(
        "UPDATE users SET is_active = 0, onboarding_status = 'blocked' WHERE id = $1",
        [id]
      )
      return res.status(200).json({ success: true, action: 'blocked' })
    }
  } catch (err) {
    console.error('[toggle-block] error', err)
    return res.status(500).json({ error: err.message })
  }
}
