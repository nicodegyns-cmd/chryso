const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      try {
        // Try getting all activities with standard columns only
        const [rows] = await pool.query('SELECT a.id, a.analytic_id, a.pay_type, a.date, a.remuneration_infi, a.remuneration_med, a.created_at FROM activities a ORDER BY a.id DESC')
        
        // If there are rows, try to get analytics and add ebrigade_activity_type if it exists
        let result = rows
        if (rows && rows.length > 0) {
          // Get analytics data
          const [analytics] = await pool.query('SELECT id, name, code FROM analytics')
          const analyticsMap = {}
          if (Array.isArray(analytics)) {
            analytics.forEach(a => analyticsMap[a.id] = a)
          }
          
          // Try to get ebrigade_activity_type for each activity
          try {
            const [activitiesWithTypes] = await pool.query('SELECT id, ebrigade_activity_type FROM activities')
            const typesMap = {}
            if (Array.isArray(activitiesWithTypes)) {
              activitiesWithTypes.forEach(a => typesMap[a.id] = a.ebrigade_activity_type)
            }
            
            result = rows.map(row => ({
              ...row,
              ebrigade_activity_type: typesMap[row.id] || null,
              analytic_name: analyticsMap[row.analytic_id]?.name || null,
              analytic_code: analyticsMap[row.analytic_id]?.code || null
            }))
          } catch (typeErr) {
            // ebrigade_activity_type column doesn't exist yet, just use rows without it
            console.log('[api/admin/activities] ebrigade_activity_type column not available yet')
            result = rows.map(row => ({
              ...row,
              ebrigade_activity_type: null,
              analytic_name: analyticsMap[row.analytic_id]?.name || null,
              analytic_code: analyticsMap[row.analytic_id]?.code || null
            }))
          }
        }
        
        return res.status(200).json({ items: result })
      } catch (queryErr) {
        console.error('[api/admin/activities] Query error:', queryErr.message)
        throw queryErr
      }
    }

    if (req.method === 'POST'){
      try {
        const { analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, date, remuneration_infi, remuneration_med } = req.body || {}
        if (!analytic_id) return res.status(400).json({ error: 'analytic_id required' })
        
        // Use ebrigade_activity_type if provided, otherwise use pay_type
        const typeToSave = ebrigade_activity_type || pay_type
        
        console.log('[api/admin/activities] POST RECEIVED:', {
          analytic_id, analytic_name, analytic_code, 
          pay_type: pay_type,
          ebrigade_activity_type: ebrigade_activity_type,
          typeToSave: typeToSave,
          fullBody: req.body
        })
        
        // Try to save with both fields if column exists
        try {
          const [result] = await pool.query(
            'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, date, remuneration_infi, remuneration_med) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [analytic_id, analytic_name||null, analytic_code||null, typeToSave||null, typeToSave||null, date||null, (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null), (typeof remuneration_med !== 'undefined' ? remuneration_med : null)]
          )
          const insertId = result.rows[0].id
          console.log('[api/admin/activities] Inserted activity:', insertId)
          
          const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [insertId])
          return res.status(201).json({ item: { ...row, ebrigade_activity_type: typeToSave } })
        } catch (err) {
          // If ebrigade_activity_type column doesn't exist, save without it
          if (err.code === '42703' || err.message.includes('ebrigade_activity_type')) {
            console.log('[api/admin/activities] Column ebrigade_activity_type not available, saving with pay_type only')
            const [result] = await pool.query(
              'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [analytic_id, analytic_name||null, analytic_code||null, typeToSave||null, date||null, (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null), (typeof remuneration_med !== 'undefined' ? remuneration_med : null)]
            )
            const insertId = result.rows[0].id
            const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [insertId])
            return res.status(201).json({ item: { ...row, ebrigade_activity_type: typeToSave } })
          }
          throw err
        }
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
