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

  // If no external service configured, read from local PostgreSQL database.
  const pool = getPool()
  try {
    if (!email) return res.status(200).json({ prestations: [] })

    // find user id by email
    const q = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [(email || '').toLowerCase()])
    const urows = (q && q.rows) ? q.rows : []
    if (!urows || urows.length === 0) return res.status(200).json({ prestations: [] })
    const userId = urows[0].id

        const sql = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status, p.analytic_id,
            p.garde_hours, p.sortie_hours, p.overtime_hours, p.hours_actual,
            p.expense_amount, p.expense_comment, p.pdf_url, p.request_ref, p.invoice_number,
            an.code AS analytic_code, an.name AS analytic_name,
            p.ebrigade_activity_name, p.ebrigade_activity_type, p.ebrigade_activity_code, p.ebrigade_id,
            p.ebrigade_duration_hours, p.ebrigade_start_time, p.ebrigade_end_time,
            CASE
              WHEN COALESCE(p.remuneration_infi, p.remuneration_med, 0) > 0
              THEN COALESCE(p.remuneration_infi, p.remuneration_med, 0)
              WHEN (act_direct.id IS NOT NULL OR act_analytic.id IS NOT NULL)
                AND (COALESCE(p.garde_hours, 0) + COALESCE(p.sortie_hours, 0) + COALESCE(p.hours_actual, 0)) > 0
              THEN
                CASE
                  WHEN u.role ILIKE '%med%' AND u.role NOT ILIKE '%infi%' THEN
                    (COALESCE(p.garde_hours, 0) + COALESCE(p.hours_actual, 0))
                      * COALESCE(act_direct.remuneration_med, act_analytic.remuneration_med, 30)
                    + COALESCE(p.sortie_hours, 0)
                      * COALESCE(act_direct.remuneration_sortie_med, act_direct.remuneration_med,
                                 act_analytic.remuneration_sortie_med, act_analytic.remuneration_med, 30)
                    + COALESCE(p.overtime_hours, 0)
                      * COALESCE(act_direct.remuneration_med, act_analytic.remuneration_med, 30)
                  ELSE
                    (COALESCE(p.garde_hours, 0) + COALESCE(p.hours_actual, 0))
                      * COALESCE(act_direct.remuneration_infi, act_analytic.remuneration_infi, 20)
                    + COALESCE(p.sortie_hours, 0)
                      * COALESCE(act_direct.remuneration_sortie_infi, act_direct.remuneration_infi,
                                 act_analytic.remuneration_sortie_infi, act_analytic.remuneration_infi, 20)
                    + COALESCE(p.overtime_hours, 0)
                      * COALESCE(act_direct.remuneration_infi, act_analytic.remuneration_infi, 20)
                END
              ELSE 0
            END AS remuneration
             FROM prestations p
               LEFT JOIN users u ON p.user_id = u.id
               LEFT JOIN analytics an ON p.analytic_id = an.id
               LEFT JOIN activities act_direct ON p.activity_id = act_direct.id
               LEFT JOIN LATERAL (
                 SELECT id, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med
                 FROM activities
                 WHERE analytic_id = p.analytic_id
                   AND p.activity_id IS NULL
                   AND p.analytic_id IS NOT NULL
                 LIMIT 1
               ) act_analytic ON true
               WHERE p.user_id = $1
               ORDER BY p.date DESC, p.id DESC
               LIMIT 500`
    let rows
    try{
      const resRows = await pool.query(sql, [userId])
      rows = (resRows && resRows.rows) ? resRows.rows : []
    }catch(qerr){
      console.warn('[api/prestations] primary query failed, retrying without expense columns', qerr && qerr.code)
      // fallback: older schema without expense_* columns
      const fallback = `SELECT p.id, p.date, p.pay_type, p.remuneration_infi, p.remuneration_med, p.status,
                        an.code AS analytic_code, an.name AS analytic_name,
                        p.ebrigade_activity_name, p.ebrigade_activity_type, p.ebrigade_activity_code, p.ebrigade_id
                 FROM prestations p
                 LEFT JOIN analytics an ON p.analytic_id = an.id
                 WHERE p.user_id = $1
                 ORDER BY p.date DESC, p.id DESC
                 LIMIT 500`
      const res2 = await pool.query(fallback, [userId])
      rows = (res2 && res2.rows) ? res2.rows : []
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
        remuneration: r.remuneration != null ? Number(r.remuneration) : 0,
        expense_amount: r.expense_amount != null ? Number(r.expense_amount) : null,
        expense_comment: r.expense_comment || null,
          pdf_url: r.pdf_url || null,
        status: r.status || null,
        analytic_code: r.analytic_code || null,
        // PREFER eBrigade activity name (full name with time/location) over local analytics name
        analytic_name: r.ebrigade_activity_name || r.analytic_name || r.analytic_code || null,
        // Also expose eBrigade fields for proper display
        ebrigade_activity_name: r.ebrigade_activity_name || null,
        ebrigade_activity_type: r.ebrigade_activity_type || null,
        ebrigade_activity_code: r.ebrigade_activity_code || null,
        ebrigade_id: r.ebrigade_id || null,
        ebrigade_duration_hours: r.ebrigade_duration_hours != null ? Number(r.ebrigade_duration_hours) : null,
        ebrigade_start_time: r.ebrigade_start_time || null,
        ebrigade_end_time: r.ebrigade_end_time || null
      }
    })

    return res.status(200).json({ prestations: formatted })
  } catch (err) {
    console.error('[api/prestations] db error', err && err.message)
    return res.status(500).json({ error: 'db_error' })
  }
}
