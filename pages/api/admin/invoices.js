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
    const base = `
      SELECT
        p.id,
        p.invoice_number,
        p.request_ref,
        p.analytic_id,
        p.user_id,
        COALESCE(NULLIF(p.remuneration_infi, 0), p.remuneration_med, p.remuneration_infi, 0) AS amount,
        p.status,
        p.created_at,
        p.pdf_url,
        p.date,
        a.name AS analytic_name,
        a.code AS analytic_code,
        u.first_name,
        u.last_name,
        u.email,
        u.company as company_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
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
    const sql = `${base}${where} ORDER BY p.date DESC, p.id DESC`

    console.log('[SQL DEBUG] admin/invoices', sql, params)
    const q = await pool.query(sql, params)
    const invoices = Array.isArray(q) ? q : (q && q.rows) ? q.rows : q

    return res.status(200).json(invoices)
  } catch (err) {
    console.error('[api/admin/invoices]', err)
    return res.status(500).json({ error: err.message })
  }
}
