// API route to return prestations for a user.
// If EXTERNAL_PRESTATIONS_URL is set it will proxy to that URL (append ?email=...)
// Otherwise this returns mock sample data useful during development.

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

  // If no external service configured, read from local MySQL database.
  const pool = getPool()
  try {
    if (!email) return res.status(200).json({ prestations: [] })

    // find user id by email
    const [urows] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [(email || '').toLowerCase()])
    if (!urows || urows.length === 0) return res.status(200).json({ prestations: [] })
    const userId = urows[0].id

        const sql = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status, p.analytic_id,
            p.garde_hours, p.sortie_hours, p.overtime_hours, p.hours_actual,
            p.expense_amount, p.expense_comment, p.pdf_url, p.request_ref, p.invoice_number,
            an.code AS analytic_code, an.name AS analytic_name
             FROM prestations p
               LEFT JOIN analytics an ON p.analytic_id = an.id
               WHERE p.user_id = ?
               ORDER BY p.date DESC, p.id DESC
               LIMIT 500`
    let rows
    try{
      const resRows = await pool.query(sql, [userId])
      rows = resRows[0] || resRows
    }catch(qerr){
      console.warn('[api/prestations] primary query failed, retrying without expense columns', qerr && qerr.code)
      // fallback: older schema without expense_* columns
      const fallback = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status,
                        an.code AS analytic_code, an.name AS analytic_name
                 FROM prestations p
                 LEFT JOIN analytics an ON p.analytic_id = an.id
                 WHERE p.user_id = ?
                 ORDER BY p.date DESC, p.id DESC
                 LIMIT 500`
      const res2 = await pool.query(fallback, [userId])
      rows = res2[0] || res2
    }

    // Normalize/format rows for frontend display:
    const formatted = (rows || []).map((r)=>{
      // format date as YYYY-MM-DD
      let date = null
      if (r.date){
        if (r.date instanceof Date) date = r.date.toISOString().slice(0,10)
        else if (typeof r.date === 'string') date = r.date.slice(0,10)
        else date = String(r.date)
      }

      return {
        id: r.id,
        date,
        pay_type: r.pay_type || null,
        analytic_id: r.analytic_id || null,
        request_ref: r.request_ref || null,
        invoice_number: r.invoice_number || null,
        garde_hours: r.garde_hours != null ? Number(r.garde_hours) : 0,
        sortie_hours: r.sortie_hours != null ? Number(r.sortie_hours) : 0,
        overtime_hours: r.overtime_hours != null ? Number(r.overtime_hours) : 0,
        hours_actual: r.hours_actual != null ? Number(r.hours_actual) : 0,
        remuneration_infi: r.remuneration_infi != null ? Number(r.remuneration_infi) : null,
        remuneration_med: r.remuneration_med != null ? Number(r.remuneration_med) : null,
        expense_amount: r.expense_amount != null ? Number(r.expense_amount) : null,
        expense_comment: r.expense_comment || null,
          pdf_url: r.pdf_url || null,
        status: r.status || null,
        analytic_code: r.analytic_code || null,
        analytic_name: r.analytic_name || r.analytic_code || null
      }
    })

    return res.status(200).json({ prestations: formatted })
  } catch (err) {
    console.error('[api/prestations] db error', err && err.message)
    return res.status(500).json({ error: 'db_error' })
  }
}
