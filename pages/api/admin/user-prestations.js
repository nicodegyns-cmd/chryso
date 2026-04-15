import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { user_id, user_email } = req.query

  if (!user_id && !user_email) {
    return res.status(400).json({ message: 'user_id ou user_email est obligatoire' })
  }

  const pool = getPool()

  try {
    let whereClauses = []
    let params = []
    let pi = 1

    if (user_id) {
      whereClauses.push(`p.user_id = $${pi++}`)
      params.push(user_id)
    }
    if (user_email) {
      whereClauses.push(`LOWER(u.email) = LOWER($${pi++})`)
      params.push(user_email)
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' OR ') : ''

    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.date,
        p.hours_actual,
        p.garde_hours,
        p.sortie_hours,
        p.overtime_hours,
        p.remuneration_infi,
        p.remuneration_med,
        p.comments,
        p.status,
        p.pay_type,
        p.activity_id,
        p.analytic_id,
        p.ebrigade_activity_name,
        p.ebrigade_activity_code,
        p.ebrigade_duration_hours,
        p.created_at,
        p.updated_at,
        an.name AS analytic_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      ${where}
      ORDER BY p.date DESC, p.id DESC
      LIMIT 100
    `

    const result = await pool.query(query, params)
    console.log('[user-prestations API] Found', result.rows.length, 'prestations')

    return res.status(200).json({
      prestations: result.rows || [],
      count: result.rows.length
    })
  } catch (err) {
    console.error('[user-prestations API] Error:', err)
    return res.status(500).json({ message: 'Erreur lors de la récupération des prestations', error: err.message })
  }
}
