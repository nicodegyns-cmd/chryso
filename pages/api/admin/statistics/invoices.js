const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { startMonth, endMonth, role, userId, analyticId } = req.query
    const pool = getPool()

    // Build date range
    let startDate = '2000-01-01'
    let endDate = '2099-12-31'
    if (startMonth) startDate = startMonth + '-01'
    if (endMonth) {
      const [year, month] = endMonth.split('-')
      const nextMonth = parseInt(month) === 12
        ? new Date(parseInt(year) + 1, 0, 1)
        : new Date(parseInt(year), parseInt(month), 1)
      endDate = nextMonth.toISOString().split('T')[0]
    }

    const clauses = ['p.date >= $1 AND p.date < $2']
    const params = [startDate, endDate]
    let idx = 3

    if (role) { clauses.push(`(u.role = $${idx} OR u.role LIKE $${idx+1})`); params.push(role, '%' + role + '%'); idx += 2 }
    if (userId) { clauses.push(`p.user_id = $${idx++}`); params.push(parseInt(userId)) }
    if (analyticId) { clauses.push(`p.analytic_id = $${idx++}`); params.push(parseInt(analyticId)) }

    const sql = `
      SELECT
        p.id,
        p.user_id,
        p.analytic_id,
        p.date,
        p.status,
        p.pay_type,
        p.hours_actual,
        p.garde_hours,
        p.sortie_hours,
        p.overtime_hours,
        p.remuneration_infi,
        p.remuneration_med,
        p.expense_amount,
        p.invoice_number,
        p.ebrigade_start_time,
        p.ebrigade_activity_name,
        u.first_name AS user_first_name,
        u.last_name  AS user_last_name,
        u.email      AS user_email,
        u.role       AS user_role,
        a.name       AS analytic_name,
        a.code       AS analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      WHERE ${clauses.join(' AND ')}
      ORDER BY p.date DESC
    `

    const result = await pool.query(sql, params)
    const rows = result.rows || []

    return res.status(200).json({ prestations: rows })
  } catch (error) {
    console.error('[statistics/invoices] error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch statistics', details: error.message })
  }
}
