import { getPool } from '../../../services/db'

// Returns pharmacien prestations grouped by user + half-month period
// Each group = one forfait of 400€
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const pool = getPool()
    const { status } = req.query

    // Get all pharmacien prestations, with analytic info from user's pharmacien_analytic_id
    let sql = `
      SELECT 
        p.id,
        p.user_id,
        p.date,
        p.hours_actual,
        p.comments,
        p.status,
        p.pay_type,
        p.pdf_url,
        u.first_name,
        u.last_name,
        u.email,
        u.role AS user_role,
        u.account,
        u.address,
        u.bce,
        u.company,
        u.pharmacien_analytic_id,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        an.id AS analytic_id,
        an.name AS analytic_name,
        an.code AS analytic_code,
        an.entite AS analytic_entite,
        an.analytic_type AS analytic_identifier,
        an.account_number AS analytic_account_number
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON u.pharmacien_analytic_id = an.id
      WHERE LOWER(p.pay_type) = 'pharmacien'
    `

    const params = []

    if (status === 'sent_to_billing') {
      sql += ` AND p.status IN ($${params.length + 1}, $${params.length + 2})`
      params.push('Envoyé à la facturation', "En attente d'approbation")
    } else if (status === 'invoiced') {
      sql += ` AND p.status = $${params.length + 1}`
      params.push('Facturé')
    } else if (status === 'all') {
      // no filter
    } else {
      // default: pending billing or approval
      sql += ` AND p.status IN ($${params.length + 1}, $${params.length + 2})`
      params.push('Envoyé à la facturation', "En attente d'approbation")
    }

    sql += ` ORDER BY p.user_id, p.date ASC`

    const result = await pool.query(sql, params)
    const rows = result.rows || []

    // Group by user + half-month period (1-15 = first half, 16-end = second half)
    const groupMap = {}
    for (const row of rows) {
      const dateStr = row.date ? String(row.date).slice(0, 10) : null
      if (!dateStr) continue
      const [year, month, dayStr] = dateStr.split('-')
      const day = parseInt(dayStr, 10)
      const halfMonth = day <= 15 ? 1 : 2
      const periodKey = `${year}-${month}-H${halfMonth}`
      const periodLabel = halfMonth === 1
        ? `1-15 ${month}/${year}`
        : `16-fin ${month}/${year}`
      const groupKey = `${row.user_id}_${periodKey}`

      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          group_key: groupKey,
          user_id: row.user_id,
          user_name: row.user_name,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          user_role: row.user_role,
          account: row.account,
          address: row.address,
          bce: row.bce,
          company: row.company,
          pharmacien_analytic_id: row.pharmacien_analytic_id || null,
          analytic_id: row.analytic_id || null,
          analytic_name: row.analytic_name || null,
          analytic_code: row.analytic_code || null,
          analytic_entite: row.analytic_entite || null,
          analytic_identifier: row.analytic_identifier || null,
          analytic_account_number: row.analytic_account_number || null,
          period_key: periodKey,
          period_label: periodLabel,
          year: parseInt(year),
          month: parseInt(month),
          half: halfMonth,
          forfait_amount: 400,
          prestations: [],
          total_hours: 0,
        }
      }

      groupMap[groupKey].prestations.push({
        id: row.id,
        date: dateStr,
        hours_actual: row.hours_actual != null ? Number(row.hours_actual) : null,
        comments: row.comments,
        status: row.status,
        pdf_url: row.pdf_url,
      })
      groupMap[groupKey].total_hours += row.hours_actual ? Number(row.hours_actual) : 0
    }

    const groups = Object.values(groupMap).sort((a, b) => {
      if (a.user_id !== b.user_id) return a.user_id - b.user_id
      return a.period_key < b.period_key ? -1 : 1
    })

    return res.status(200).json({ groups })
  } catch (err) {
    console.error('[pharmacien-forfaits]', err)
    return res.status(500).json({ error: err.message })
  }
}
