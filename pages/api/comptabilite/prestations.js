// pages/api/comptabilite/prestations.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { status } = req.query

    let sql = `
      SELECT 
        p.id,
        p.user_id,
        p.analytic_id,
        p.ebrigade_activity_code,
        p.ebrigade_analytic_id,
        COALESCE(a.name, eba.name, aam.ebrigade_analytic_name, p.ebrigade_activity_code, 'Non assigné') AS analytic_name,
        COALESCE(a.code, '') AS analytic_code,
        act.pay_type AS activity_type,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
        p.date,
        p.status,
        p.created_at,
        p.pdf_url,
        u.first_name,
        u.last_name,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      LEFT JOIN ebrigade_analytics eba ON p.ebrigade_analytic_id = eba.id
      LEFT JOIN activities act ON p.activity_id = act.id
      LEFT JOIN activity_ebrigade_mappings aam ON p.ebrigade_activity_code = aam.ebrigade_code
      WHERE 1=1
    `
    const params = []

    // Filter by status - map UI statuses to DB statuses
    if (status && status !== 'all') {
      // Map sent_to_billing UI status to actual DB status "Envoyé à la facturation"
      if (status === 'sent_to_billing') {
        sql += ` AND p.status = $1`
        params.push('Envoyé à la facturation')
      } else if (status === 'invoiced') {
        sql += ` AND p.status = $1`
        params.push('Facturé')
      } else if (status === 'paid') {
        sql += ` AND p.status = $1`
        params.push('Payé')
      }
    } else {
      // Default: show prestations sent to billing (Envoyé à la facturation)
      sql += ` AND p.status = $1`
      params.push('Envoyé à la facturation')
    }

    sql += ` ORDER BY p.date DESC, p.created_at DESC`

    const result = await pool.query(sql, params)
    const prestations = result.rows || result[0] || []
    
    return res.status(200).json(prestations)
  } catch (err) {
    console.error('[api/comptabilite/prestations]', err)
    return res.status(500).json({ error: err.message })
  }
}
