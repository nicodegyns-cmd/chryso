// pages/api/admin/invoices.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { status, period } = req.query

    let sql = `
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
      WHERE 1=1
    `
    const params = []

    // Filter by status
    if (status && status !== 'tous') {
      sql += ` AND i.status = ?`
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
        sql += ` AND i.created_at >= ?`
        params.push(startDate.toISOString())
      }
    }

    sql += ` ORDER BY i.created_at DESC`

    const invoices = await getPool().query(sql, params)
    
    return res.status(200).json(invoices)
  } catch (err) {
    console.error('[api/admin/invoices]', err)
    return res.status(500).json({ error: err.message })
  }
}
