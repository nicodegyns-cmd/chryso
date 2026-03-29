// API route to return prestations for a user.
const { getPool } = require('../../services/db')

export default async function handler(req, res) {
  const { email } = req.query || {}

  const external = process.env.EXTERNAL_PRESTATIONS_URL
  if (external) {
    try {
      const url = new URL(external)
      if (email) url.searchParams.set('email', email)
      const r = await fetch(url.toString())
      const data = await r.json()
      return res.status(r.ok ? 200 : 502).json({ prestations: data.prestations || data || [] })
    } catch (err) {
      console.error('Proxy to external prestations failed', err)
      return res.status(502).json({ error: 'External service unavailable' })
    }
  }

  const pool = getPool()
  try {
    if (!email) return res.status(200).json({ prestations: [] })

    const q = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [(email || '').toLowerCase()])
    const urows = (q && q.rows) ? q.rows : []
    if (!urows || urows.length === 0) return res.status(200).json({ prestations: [] })
    const userId = urows[0].id

    const sql = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status, p.analytic_id,
            p.garde_hours, p.sortie_hours, p.overtime_hours, p.hours_actual,
            p.expense_amount, p.expense_comment, p.pdf_url, p.request_ref, p.invoice_number,
            an.code AS analytic_code, an.name AS analytic_name
             FROM prestations p
               LEFT JOIN analytics an ON p.analytic_id = an.id
               WHERE p.user_id = $1
               ORDER BY p.date DESC, p.id DESC
               LIMIT 500`
    let rows
    try{
      const resRows = await pool.query(sql, [userId])
      rows = (resRows && resRows.rows) ? resRows.rows : []
    }catch(qerr){
      const fallback = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status,
                        an.code AS analytic_code, an.name AS analytic_name
                 FROM prestations p
                 LEFT JOIN analytics an ON p.analytic_id = an.id
                 WHERE p.user_id = $1
                 ORDER BY p.date DESC, p.id DESC
                 LIMIT 500`
      const res2 = await pool.query(fallback, [userId])
      rows = (res2 && res2.rows) ? res2.rows : []
    }

    return res.status(200).json({ prestations: rows || [] })
  } catch (err) {
    console.error('[api/prestations] db error', err && err.message)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
