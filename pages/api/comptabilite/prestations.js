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
        p.ebrigade_activity_name,
        COALESCE(a.name, 'Non assigné') AS analytic_name,
        COALESCE(a.code, '') AS analytic_code,
        act.pay_type AS activity_type,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration_base,
        p.overtime_hours,
        p.hours_actual,
        p.garde_hours,
        p.sortie_hours,
        CASE
          -- Stored totals exist and are non-zero: use them (with overtime adjustment if needed)
          WHEN COALESCE(p.remuneration_infi, p.remuneration_med, 0) > 0
            AND COALESCE(p.overtime_hours, 0) > 0
            AND (COALESCE(p.hours_actual, 0) + COALESCE(p.garde_hours, 0) + COALESCE(p.sortie_hours, 0)) > 0
          THEN COALESCE(p.remuneration_infi, p.remuneration_med, 0)
               + (COALESCE(p.overtime_hours, 0)
                  * (COALESCE(p.remuneration_infi, p.remuneration_med, 0)
                     / (COALESCE(p.hours_actual, 0) + COALESCE(p.garde_hours, 0) + COALESCE(p.sortie_hours, 0))))
          WHEN COALESCE(p.remuneration_infi, p.remuneration_med, 0) > 0
          THEN COALESCE(p.remuneration_infi, p.remuneration_med, 0)
          -- Fallback: stored totals are NULL/0 — recalculate from hours × activity rates
          WHEN act.id IS NOT NULL
            AND (COALESCE(p.garde_hours, 0) + COALESCE(p.sortie_hours, 0) + COALESCE(p.hours_actual, 0)) > 0
          THEN
            CASE
              WHEN u.role ILIKE '%med%' AND u.role NOT ILIKE '%infi%' THEN
                (COALESCE(p.garde_hours, 0) + COALESCE(p.hours_actual, 0)) * COALESCE(act.remuneration_med, 30)
                + COALESCE(p.sortie_hours, 0) * COALESCE(act.remuneration_sortie_med, act.remuneration_med, 30)
                + COALESCE(p.overtime_hours, 0) * COALESCE(act.remuneration_med, 30)
              ELSE
                (COALESCE(p.garde_hours, 0) + COALESCE(p.hours_actual, 0)) * COALESCE(act.remuneration_infi, 20)
                + COALESCE(p.sortie_hours, 0) * COALESCE(act.remuneration_sortie_infi, act.remuneration_infi, 20)
                + COALESCE(p.overtime_hours, 0) * COALESCE(act.remuneration_infi, 20)
            END
          ELSE 0
        END AS remuneration,
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
      LEFT JOIN activities act ON p.activity_id = act.id
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
    } else if (!status) {
      // Default: show prestations sent to billing
      sql += ` AND p.status = $1`
      params.push('Envoyé à la facturation')
    }
    // status === 'all' → no filter, show everything

    sql += ` ORDER BY p.date DESC, p.created_at DESC`

    const result = await pool.query(sql, params)
    const prestations = result.rows || result[0] || []
    
    return res.status(200).json(prestations)
  } catch (err) {
    console.error('[api/comptabilite/prestations]', err)
    return res.status(500).json({ error: err.message })
  }
}
