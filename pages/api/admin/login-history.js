import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const pool = getPool()
  try {
    const [rowsQ, statsQ] = await Promise.all([
      pool.query(
        `SELECT id, user_id, email, first_name, last_name, role, ip_address, user_agent, logged_in_at
         FROM login_history
         ORDER BY logged_in_at DESC
         LIMIT 500`
      ),
      pool.query(
        `SELECT
           COUNT(*)                                                          AS total,
           COUNT(*) FILTER (WHERE logged_in_at >= NOW() - INTERVAL '24 hours') AS last_24h,
           COUNT(*) FILTER (WHERE logged_in_at >= NOW() - INTERVAL '7 days')   AS last_7d,
           COUNT(*) FILTER (WHERE logged_in_at >= NOW() - INTERVAL '30 days')  AS last_30d,
           COUNT(DISTINCT email)                                            AS unique_users,
           COUNT(DISTINCT email) FILTER (WHERE logged_in_at >= NOW() - INTERVAL '24 hours') AS unique_24h,
           COUNT(DISTINCT ip_address)                                       AS unique_ips,
           (SELECT role FROM login_history GROUP BY role ORDER BY COUNT(*) DESC LIMIT 1) AS top_role,
           (SELECT TO_CHAR(DATE_TRUNC('hour', logged_in_at), 'HH24') || 'h'
            FROM login_history
            GROUP BY DATE_TRUNC('hour', logged_in_at)
            ORDER BY COUNT(*) DESC LIMIT 1)                                 AS peak_hour
         FROM login_history`
      )
    ])

    const rows = rowsQ.rows || []
    const stats = (statsQ.rows || [])[0] || {}

    return res.status(200).json({ rows, stats })
  } catch (e) {
    console.error('[api/admin/login-history]', e)
    return res.status(500).json({ error: e.message })
  }
}
