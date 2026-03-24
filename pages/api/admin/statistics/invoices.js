import db from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { startMonth, endMonth, role, userId, analyticId } = req.query

    // Build date range
    let startDate = '2000-01-01'
    let endDate = '2099-12-31'

    if (startMonth) {
      startDate = startMonth + '-01'
    }
    if (endMonth) {
      // End of the month
      const [year, month] = endMonth.split('-')
      const nextMonth = parseInt(month) === 12 
        ? new Date(parseInt(year) + 1, 0, 1)
        : new Date(parseInt(year), parseInt(month), 1)
      endDate = nextMonth.toISOString().split('T')[0]
    }

    // Build query
    let query = `
      SELECT 
        p.id,
        p.user_id,
        p.analytic_id,
        p.date,
        p.pay_type,
        p.remuneration_infi,
        p.remuneration_med,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.role as user_role,
        a.name as analytic_name,
        a.code as analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      WHERE p.date >= $1 AND p.date < $2
    `

    const params = [startDate, endDate]
    let paramCount = 2

    if (role && role !== '') {
      paramCount++
      query += ` AND u.role = $${paramCount}`
      params.push(role)
    }

    if (userId && userId !== '') {
      paramCount++
      query += ` AND p.user_id = $${paramCount}`
      params.push(parseInt(userId))
    }

    if (analyticId && analyticId !== '') {
      paramCount++
      query += ` AND p.analytic_id = $${paramCount}`
      params.push(parseInt(analyticId))
    }

    query += ` ORDER BY p.date DESC`

    const result = await db.query(query, params)

    return res.status(200).json({
      prestations: result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        analytic_id: row.analytic_id,
        date: row.date,
        pay_type: row.pay_type,
        remuneration_infi: row.remuneration_infi ? parseFloat(row.remuneration_infi) : 0,
        remuneration_med: row.remuneration_med ? parseFloat(row.remuneration_med) : 0,
        user_firstName: row.user_first_name,
        user_lastName: row.user_last_name,
        user_email: row.user_email,
        user_role: row.user_role,
        analytic_name: row.analytic_name,
        analytic_code: row.analytic_code
      }))
    })
  } catch (error) {
    console.error('Statistics query error:', error)
    return res.status(500).json({ error: 'Failed to fetch statistics' })
  }
}
