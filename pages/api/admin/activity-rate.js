import { getPool } from '../../../services/db'

// GET /api/admin/activity-rate?analytic_id=X
// Returns the most recent remuneration_infi and remuneration_med for a given analytic_id
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const pool = getPool()
  const { analytic_id } = req.query
  if (!analytic_id) return res.status(400).json({ error: 'analytic_id required' })

  try {
    const q = await pool.query(
      `SELECT remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, pay_type
       FROM activities
       WHERE analytic_id = $1 AND (remuneration_infi IS NOT NULL OR remuneration_med IS NOT NULL)
       ORDER BY date DESC, id DESC
       LIMIT 1`,
      [analytic_id]
    )
    const rows = q.rows || []
    if (!rows.length) return res.status(200).json({ rate: null })
    return res.status(200).json({ rate: rows[0] })
  } catch (err) {
    console.error('[activity-rate] error', err)
    return res.status(500).json({ error: 'db_error' })
  }
}
