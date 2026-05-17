import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { year, month } = req.query
  if (!year) return res.status(400).json({ error: 'year required' })

  try {
    const pool = getPool()

    let dateFilter = `EXTRACT(YEAR FROM p.date::date) = $1`
    const params = [parseInt(year)]
    if (month) {
      dateFilter += ` AND EXTRACT(MONTH FROM p.date::date) = $2`
      params.push(parseInt(month))
    }

    // Summary
    const summaryQ = await pool.query(`
      SELECT
        ROUND(SUM(p.hours_actual)::numeric, 1) AS total_hours,
        COUNT(DISTINCT p.date::date || '_' || p.user_id) AS total_days,
        COUNT(DISTINCT p.user_id) AS total_pharmaciens,
        CASE WHEN COUNT(DISTINCT p.date::date || '_' || p.user_id) > 0
          THEN ROUND((SUM(p.hours_actual) / COUNT(DISTINCT p.date::date || '_' || p.user_id))::numeric, 1)
          ELSE 0 END AS avg_hours_per_day
      FROM prestations p
      WHERE LOWER(p.pay_type) = 'pharmacien'
        AND ${dateFilter}
    `, params)

    // By user
    const byUserQ = await pool.query(`
      SELECT
        p.user_id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email, p.user_id::text) AS full_name,
        a.name AS analytic_name,
        ROUND(SUM(p.hours_actual)::numeric, 1) AS total_hours,
        COUNT(DISTINCT p.date::date) AS total_days,
        CASE WHEN COUNT(DISTINCT p.date::date) > 0
          THEN ROUND((SUM(p.hours_actual) / COUNT(DISTINCT p.date::date))::numeric, 1)
          ELSE 0 END AS avg_hours
      FROM prestations p
      LEFT JOIN users u ON u.id = p.user_id::integer
      LEFT JOIN analytics a ON a.id = u.pharmacien_analytic_id
      WHERE LOWER(p.pay_type) = 'pharmacien'
        AND ${dateFilter}
      GROUP BY p.user_id, COALESCE(u.first_name || ' ' || u.last_name, u.email, p.user_id::text), a.name
      ORDER BY total_hours DESC
    `, params)

    // By month (only when no month filter)
    let byMonth = []
    if (!month) {
      const byMonthQ = await pool.query(`
        SELECT
          EXTRACT(MONTH FROM p.date::date)::int AS month,
          ROUND(SUM(p.hours_actual)::numeric, 1) AS total_hours,
          COUNT(DISTINCT p.date::date || '_' || p.user_id) AS total_days,
          COUNT(DISTINCT p.user_id) AS pharmaciens_count
        FROM prestations p
        WHERE LOWER(p.pay_type) = 'pharmacien'
          AND ${dateFilter}
        GROUP BY month
        ORDER BY month
      `, params)
      byMonth = byMonthQ.rows
    }

    // By analytic
    const byAnalyticQ = await pool.query(`
      SELECT
        COALESCE(a.name, p.analytic_name, 'Non assigné') AS analytic_name,
        ROUND(SUM(p.hours_actual)::numeric, 1) AS total_hours,
        COUNT(DISTINCT p.date::date || '_' || p.user_id) AS total_days,
        COUNT(DISTINCT p.user_id) AS pharmaciens_count
      FROM prestations p
      LEFT JOIN users u ON u.id = p.user_id::integer
      LEFT JOIN analytics a ON a.id = u.pharmacien_analytic_id
      WHERE LOWER(p.pay_type) = 'pharmacien'
        AND ${dateFilter}
      GROUP BY analytic_name
      ORDER BY total_hours DESC
    `, params)

    const s = summaryQ.rows[0]
    return res.status(200).json({
      summary: {
        total_hours: Number(s.total_hours) || 0,
        total_days: Number(s.total_days) || 0,
        total_pharmaciens: Number(s.total_pharmaciens) || 0,
        avg_hours_per_day: Number(s.avg_hours_per_day) || 0,
      },
      by_user: byUserQ.rows,
      by_month: byMonth,
      by_analytic: byAnalyticQ.rows,
    })
  } catch (err) {
    console.error('[api/admin/statistics/pharmacien]', err)
    return res.status(500).json({ error: err.message })
  }
}
