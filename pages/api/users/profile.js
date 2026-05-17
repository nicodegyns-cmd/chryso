import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'email required' })
  try {
    const pool = getPool()
    const q = await pool.query(
      `SELECT u.pharmacien_analytic_id, a.name AS analytic_name
       FROM users u
       LEFT JOIN analytics a ON a.id = u.pharmacien_analytic_id
       WHERE u.email = $1 AND u.role = 'pharmacien'
       LIMIT 1`,
      [email]
    )
    if (q.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    const row = q.rows[0]
    return res.status(200).json({
      pharmacien_analytic_id: row.pharmacien_analytic_id || null,
      analytic_name: row.analytic_name || null,
    })
  } catch (err) {
    console.error('[api/users/profile]', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
