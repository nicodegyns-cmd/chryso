import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()
  try {
    const q = await pool.query(
      `SELECT id, user_id, email, first_name, last_name, role, ip_address, user_agent, logged_in_at
       FROM login_history
       ORDER BY logged_in_at DESC
       LIMIT 300`
    )
    const rows = q.rows || []
    return res.status(200).json(rows)
  } catch (e) {
    console.error('[api/admin/login-history]', e)
    return res.status(500).json({ error: e.message })
  }
}
