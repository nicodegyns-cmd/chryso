const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      try {
        const [rows] = await pool.query('SELECT a.id, a.analytic_id, a.pay_type, a.ebrigade_activity_type, a.date, a.remuneration_infi, a.remuneration_med, a.created_at FROM activities a ORDER BY a.id DESC')
        
        // If there are rows, try to join analytics data, otherwise skip
        let result = rows
        if (rows && rows.length > 0) {
          const [analytics] = await pool.query('SELECT id, name, code FROM analytics')
          const analyticsMap = {}
          if (Array.isArray(analytics)) {
            analytics.forEach(a => analyticsMap[a.id] = a)
          }
          
          result = rows.map(row => ({
            ...row,
            analytic_name: analyticsMap[row.analytic_id]?.name || null,
            analytic_code: analyticsMap[row.analytic_id]?.code || null
          }))
        }
        
        return res.status(200).json({ items: result })
      } catch (queryErr) {
        console.error('[api/admin/activities] Query error:', queryErr)
        throw queryErr
      }
    }

    if (req.method === 'POST'){
      try {
        const { analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, date, remuneration_infi, remuneration_med } = req.body || {}
        if (!analytic_id) return res.status(400).json({ error: 'analytic_id required' })
        
        console.log('[api/admin/activities] POST payload:', {
          analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type
        })
        
        const [result] = await pool.execute(
          'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, date, remuneration_infi, remuneration_med) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [analytic_id, analytic_name||null, analytic_code||null, pay_type||null, ebrigade_activity_type||null, date||null, (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null), (typeof remuneration_med !== 'undefined' ? remuneration_med : null)]
        )
        const insertId = result.insertId
        console.log('[api/admin/activities] Inserted activity:', insertId)
        
        const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = ?', [insertId])
        return res.status(201).json({ item: row })
      } catch (postErr) {
        console.error('[api/admin/activities] POST error:', postErr)
        throw postErr
      }
    }

    res.setHeader('Allow','GET,POST')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('[api/admin/activities] Unexpected error:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      stack: err.stack
    })
    res.status(500).json({ error: 'internal', message: err.message })
  }
}
