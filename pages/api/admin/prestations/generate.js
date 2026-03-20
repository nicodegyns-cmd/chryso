const { getPool } = require('../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method !== 'POST'){
      res.setHeader('Allow','POST')
      return res.status(405).end('Method Not Allowed')
    }
    const { user_id, type, date, activity_id } = req.body || {}
    try{ console.log('[generate] incoming payload', { user_id, type, date, activity_id }) }catch(e){}
    if (!user_id || !type || !date) return res.status(400).json({ error: 'missing required fields: user_id, type, date' })

    // If activity_id provided, attempt to resolve analytic_id from that activity
    let analyticId = null
    if (activity_id) {
      try{
        const [[act]] = await pool.query('SELECT analytic_id FROM activities WHERE id = ? LIMIT 1', [activity_id])
        if (act && act.analytic_id) analyticId = act.analytic_id
      }catch(e){
        console.warn('failed to resolve activity analytic', e)
      }
    }

        // Very small generator: insert a prestation row with provided info.
    // If analyticId is found, set it on the prestation so it links to analytic/activity context.
        const sql = `INSERT INTO prestations (user_id, analytic_id, activity_id, date, pay_type, remuneration_infi, status, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, 'A saisir', NOW())`
        const [result] = await pool.query(sql, [user_id, analyticId, activity_id || null, date, type])
    const id = result.insertId

    const [rows] = await pool.query('SELECT * FROM prestations WHERE id = ? LIMIT 1', [id])
    return res.status(200).json({ item: rows[0] })
  }catch(err){
    console.error('generate prestation error', err && err.stack ? err.stack : err)
    // Return detailed error in dev so client shows useful message
    res.status(500).json({ error: err && err.message ? err.message : 'internal', stack: err && err.stack ? err.stack : null })
  }
}
