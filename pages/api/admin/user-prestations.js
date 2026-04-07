import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { user_id } = req.query

  if (!user_id) {
    return res.status(400).json({ message: 'user_id est obligatoire' })
  }

  console.log('[user-prestations API] Searching for user_id:', user_id)

  const pool = getPool()

  try {
    const query = `
      SELECT 
        id,
        user_id,
        date,
        hours_actual,
        garde_hours,
        sortie_hours,
        overtime_hours,
        remuneration_infi,
        remuneration_med,
        comments,
        status,
        pay_type,
        activity_id,
        created_at,
        updated_at
      FROM prestations
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
      LIMIT 50
    `

    const result = await pool.query(query, [user_id])
    console.log('[user-prestations API] Found', result.rows.length, 'prestations for user_id:', user_id)

    return res.status(200).json({
      prestations: result.rows || [],
      count: result.rows.length
    })
  } catch (err) {
    console.error('[user-prestations API] Error:', err)
    return res.status(500).json({ message: 'Erreur lors de la récupération des prestations', error: err.message })
  }
}
