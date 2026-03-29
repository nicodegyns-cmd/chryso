// pages/api/admin/invoices.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { status, period } = req.query

    const base = `
      SELECT
        i.id,
        i.invoice_number,
        i.analytic_id,
        i.user_id,
        i.amount,
        i.status,
        i.created_at,
        i.due_date,
        a.name AS analytic_name,
        u.first_name,
        u.last_name,
        u.email,
        u.company as company_name
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN analytics a ON i.analytic_id = a.id
    `

    const clauses = []
    const params = []

    // Filter by status
    if (status && status !== 'tous') {
      clauses.push('i.status = ?')
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
        clauses.push('i.created_at >= ?')
        params.push(startDate.toISOString())
      }
    }

    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const sql = `${base}${where} ORDER BY i.created_at DESC`

    console.log('[SQL DEBUG] admin/invoices', sql, params)
    const q = await getPool().query(sql, params)
    const invoices = Array.isArray(q) ? q : (q && q.rows) ? q.rows : q

    return res.status(200).json(invoices)
  } catch (err) {
    console.error('[api/admin/invoices]', err)
    return res.status(500).json({ error: err.message })
  }
}
