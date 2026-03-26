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
        a.name AS analytic_name,
        a.code AS analytic_code,
        act.pay_type AS activity_type,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
        p.date,
        p.status,
        p.created_at,
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

    // Filter by status
    if (status && status !== 'all') {
      sql += ` AND p.status = ?`
      params.push(status)
    }

    // Default: show sent_to_billing and invoiced prestations
    if (!status || status === 'sent_to_billing') {
      sql = `
        SELECT 
          p.id,
          p.user_id,
          p.analytic_id,
          a.name AS analytic_name,
          a.code AS analytic_code,
          act.pay_type AS activity_type,
          COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
          p.date,
          p.status,
          p.created_at,
          u.first_name,
          u.last_name,
          u.email,
          CONCAT(u.first_name, ' ', u.last_name) as user_name
        FROM prestations p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN analytics a ON p.analytic_id = a.id
        LEFT JOIN activities act ON p.activity_id = act.id
        WHERE p.status IN ('sent_to_billing', 'invoiced')
      `
    }

    sql += ` ORDER BY p.date DESC, p.created_at DESC`

    const prestations = await pool.query(sql, params)
    
    return res.status(200).json(prestations)
  } catch (err) {
    console.error('[api/comptabilite/prestations]', err)
    return res.status(500).json({ error: err.message })
  }
}
