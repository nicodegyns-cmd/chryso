// pages/api/admin/invoices.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { status, period } = req.query

    // Fetch from prestations table with pdf_url (new system)
    // Group by invoice_number to avoid one row per prestation
    // Amount is computed from hours × rates (same formula as PDF generation)
    const base = `
      SELECT
        MIN(p.id) AS id,
        p.invoice_number,
        MAX(p.pdf_url) AS pdf_url,
        MIN(p.user_id) AS user_id,
        MIN(p.analytic_id) AS analytic_id,
        SUM(
          CASE
            WHEN COALESCE(p.garde_hours, 0) + COALESCE(p.sortie_hours, 0) > 0 THEN
              -- Garde hours × rate
              COALESCE(p.garde_hours, 0) * COALESCE(
                NULLIF(
                  CASE WHEN u.role ILIKE '%med%'
                    THEN COALESCE(NULLIF(act.remuneration_med, 0), act_nm.remuneration_med)
                    ELSE COALESCE(NULLIF(act.remuneration_infi, 0), act_nm.remuneration_infi)
                  END, 0),
                0
              ) +
              -- Sortie hours × rate (fallback to garde rate)
              COALESCE(p.sortie_hours, 0) * COALESCE(
                NULLIF(
                  CASE WHEN u.role ILIKE '%med%'
                    THEN COALESCE(NULLIF(act.remuneration_sortie_med, 0), act_nm.remuneration_sortie_med,
                                  NULLIF(act.remuneration_med, 0), act_nm.remuneration_med)
                    ELSE COALESCE(NULLIF(act.remuneration_sortie_infi, 0), act_nm.remuneration_sortie_infi,
                                  NULLIF(act.remuneration_infi, 0), act_nm.remuneration_infi)
                  END, 0),
                0
              ) +
              -- Overtime hours × garde rate
              COALESCE(p.overtime_hours, 0) * COALESCE(
                NULLIF(
                  CASE WHEN u.role ILIKE '%med%'
                    THEN COALESCE(NULLIF(act.remuneration_med, 0), act_nm.remuneration_med)
                    ELSE COALESCE(NULLIF(act.remuneration_infi, 0), act_nm.remuneration_infi)
                  END, 0),
                0
              )
            ELSE
              -- No hours breakdown: use stored remuneration value
              COALESCE(NULLIF(p.remuneration_infi, 0), p.remuneration_med, p.remuneration_infi, 0)
          END
        ) AS amount,
        SUM(COALESCE(p.expense_amount, 0)) AS expense_amount,
        MAX(p.status) AS status,
        MAX(p.created_at) AS created_at,
        MAX(p.date) AS date,
        MIN(a.name) AS analytic_name,
        MIN(a.code) AS analytic_code,
        MIN(u.first_name) AS first_name,
        MIN(u.last_name) AS last_name,
        MIN(u.email) AS email,
        MIN(u.company) AS company_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      LEFT JOIN activities act ON p.activity_id = act.id
      LEFT JOIN activity_ebrigade_name_mappings nm
        ON nm.ebrigade_analytic_name_pattern = TRIM(SPLIT_PART(COALESCE(p.ebrigade_activity_name, ''), '|', 1))
      LEFT JOIN activities act_nm ON act_nm.id = nm.activity_id
      WHERE p.pdf_url IS NOT NULL AND p.pdf_url != ''
    `

    const clauses = []
    const params = []

    // Filter by status
    if (status && status !== 'tous') {
      clauses.push('p.status = $' + (params.length + 1))
      params.push(status)
    }

    // Filter by period
    if (period && period !== 'all') {
      const now = new Date()
      let startDate

      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (period === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
      } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1)
      }

      if (startDate) {
        clauses.push('p.created_at >= $' + (params.length + 1))
        params.push(startDate.toISOString())
      }
    }

    const where = clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''
    const sql = `${base}${where} GROUP BY p.invoice_number ORDER BY MAX(p.date) DESC, MIN(p.id) DESC`

    const q = await pool.query(sql, params)
    const invoices = q.rows || (Array.isArray(q[0]) ? q[0] : [])

    return res.status(200).json(invoices)
  } catch (err) {
    console.error('[api/admin/invoices]', err)
    return res.status(500).json({ error: err.message })
  }
}
