const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      try {
        // Try getting all activities with standard columns only
        const q = await pool.query('SELECT a.id, a.analytic_id, a.pay_type, a.date, a.remuneration_infi, a.remuneration_med, a.created_at FROM activities a ORDER BY a.id DESC')
        const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
        
        // If there are rows, try to get analytics and add ebrigade_activity_type if it exists
        let result = rows
        if (rows && rows.length > 0) {
          // Get analytics data
            const q2sql = 'SELECT id, name, code FROM analytics'
            console.log('[SQL DEBUG] admin/activities analytics', q2sql, [])
            const q2 = await pool.query(q2sql)
          const analytics = (q2 && q2.rows) ? q2.rows : Array.isArray(q2) ? q2[0] : []
          const analyticsMap = {}
          if (Array.isArray(analytics)) {
            analytics.forEach(a => analyticsMap[a.id] = a)
          }
          
          // Get eBrigade mappings for all activities
          let ebrigadeMappings = {}
          try {
            const ebQ = await pool.query(`
              SELECT activity_id, ebrigade_analytic_name 
              FROM activity_ebrigade_mappings 
              WHERE activity_id = ANY($1)
              ORDER BY activity_id, ebrigade_analytic_name
            `, [rows.map(r => r.id)])
            const ebRows = (ebQ && ebQ.rows) ? ebQ.rows : []
            ebRows.forEach(row => {
              if (!ebrigadeMappings[row.activity_id]) {
                ebrigadeMappings[row.activity_id] = []
              }
              ebrigadeMappings[row.activity_id].push(row.ebrigade_analytic_name)
            })
          } catch (ebErr) {
            console.log('[api/admin/activities] activity_ebrigade_mappings table not available yet')
          }
          
          // Try to get ebrigade_activity_type for each activity
          try {
            const q3sql = 'SELECT id, ebrigade_activity_type, hour_entry_type FROM activities'
            console.log('[SQL DEBUG] admin/activities types', q3sql, [])
            const q3 = await pool.query(q3sql)
            const activitiesWithTypes = (q3 && q3.rows) ? q3.rows : Array.isArray(q3) ? q3[0] : []
            const typesMap = {}
            if (Array.isArray(activitiesWithTypes)) {
              activitiesWithTypes.forEach(a => { typesMap[a.id] = { ebrigade_activity_type: a.ebrigade_activity_type, hour_entry_type: a.hour_entry_type } })
            }
            
            result = rows.map(row => ({
              ...row,
              ebrigade_activity_type: typesMap[row.id]?.ebrigade_activity_type || null,
              hour_entry_type: typesMap[row.id]?.hour_entry_type || null,
              ebrigade_analytics: ebrigadeMappings[row.id] || [],
              analytic_name: analyticsMap[row.analytic_id]?.name || null,
              analytic_code: analyticsMap[row.analytic_id]?.code || null
            }))
          } catch (typeErr) {
            // ebrigade_activity_type column doesn't exist yet, just use rows without it
            console.log('[api/admin/activities] ebrigade_activity_type column not available yet')
            result = rows.map(row => ({
              ...row,
              ebrigade_activity_type: null,
              hour_entry_type: null,
              ebrigade_analytics: ebrigadeMappings[row.id] || [],
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
        const { analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, hour_entry_type, date, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, remuneration_overtime_infi, remuneration_overtime_med, ebrigade_analytics } = req.body || {}
        if (!analytic_id) return res.status(400).json({ error: 'analytic_id required' })
        
        // Use ebrigade_activity_type if provided, otherwise use pay_type
        const typeToSave = ebrigade_activity_type || pay_type
        
        console.log('[api/admin/activities] POST RECEIVED:', {
          analytic_id, analytic_name, analytic_code, 
          pay_type: pay_type,
          ebrigade_activity_type: ebrigade_activity_type,
          typeToSave: typeToSave,
          ebrigade_analytics: ebrigade_analytics,
          fullBody: req.body
        })
        
        // Ensure activity_ebrigade_mappings table exists
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_ebrigade_mappings (
              id SERIAL PRIMARY KEY,
              activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
              ebrigade_analytic_name VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(activity_id, ebrigade_analytic_name)
            )
          `)
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_ebrigade_mappings_activity_id ON activity_ebrigade_mappings(activity_id)`)
        } catch (tableErr) {
          console.log('[api/admin/activities] Table creation/check done')
        }
        
        // Ensure sortie & overtime columns exist
        try { await pool.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_sortie_infi NUMERIC(10,2) DEFAULT NULL") } catch(e) {}
        try { await pool.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_sortie_med NUMERIC(10,2) DEFAULT NULL") } catch(e) {}
        try { await pool.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_overtime_infi NUMERIC(10,2) DEFAULT NULL") } catch(e) {}
        try { await pool.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_overtime_med NUMERIC(10,2) DEFAULT NULL") } catch(e) {}
        try { await pool.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS hour_entry_type VARCHAR(20) DEFAULT NULL") } catch(e) {}

        // Try to save with both fields if column exists
        let insertId
        try {
          const insertQ = await pool.query(
            'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, ebrigade_activity_type, hour_entry_type, date, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, remuneration_overtime_infi, remuneration_overtime_med) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [analytic_id, analytic_name||null, analytic_code||null, typeToSave||null, typeToSave||null, hour_entry_type||null, date||null,
              (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null),
              (typeof remuneration_med !== 'undefined' ? remuneration_med : null),
              (typeof remuneration_sortie_infi !== 'undefined' ? remuneration_sortie_infi : null),
              (typeof remuneration_sortie_med !== 'undefined' ? remuneration_sortie_med : null),
              (typeof remuneration_overtime_infi !== 'undefined' ? remuneration_overtime_infi : null),
              (typeof remuneration_overtime_med !== 'undefined' ? remuneration_overtime_med : null),
            ]
          )
          insertId = (insertQ && insertQ.rows && insertQ.rows[0]) ? insertQ.rows[0].id : (Array.isArray(insertQ) && insertQ[0] && insertQ[0].insertId) ? insertQ[0].insertId : null
          console.log('[api/admin/activities] Inserted activity:', insertId)
          
          // Save eBrigade mappings if provided
          if (insertId && Array.isArray(ebrigade_analytics) && ebrigade_analytics.length > 0) {
            console.log('[api/admin/activities] Saving eBrigade mappings for activity', insertId, ebrigade_analytics)
            for (const analyticName of ebrigade_analytics) {
              try {
                await pool.query(
                  'INSERT INTO activity_ebrigade_mappings (activity_id, ebrigade_analytic_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [insertId, analyticName]
                )
                console.log('[api/admin/activities] Saved mapping', analyticName)
              } catch (mappingErr) {
                console.warn('[api/admin/activities] Failed to save mapping for', analyticName, mappingErr.message)
              }
            }
          }
          
          const selQ = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [insertId])
          const row = (selQ && selQ.rows && selQ.rows[0]) ? selQ.rows[0] : (Array.isArray(selQ) ? selQ[0] : null)
          return res.status(201).json({ item: { ...row, ebrigade_activity_type: typeToSave } })
        } catch (err) {
          // If ebrigade_activity_type column doesn't exist, save without it
          if (err && (err.code === '42703' || (err.message && err.message.includes('ebrigade_activity_type')))) {
            console.log('[api/admin/activities] Column ebrigade_activity_type not available, saving with pay_type only')
            const insertQ2 = await pool.query(
              'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [analytic_id, analytic_name||null, analytic_code||null, typeToSave||null, date||null, (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null), (typeof remuneration_med !== 'undefined' ? remuneration_med : null)]
            )
            const insertId2 = (insertQ2 && insertQ2.rows && insertQ2.rows[0]) ? insertQ2.rows[0].id : (Array.isArray(insertQ2) && insertQ2[0] && insertQ2[0].insertId) ? insertQ2[0].insertId : null
            
            // Save eBrigade mappings if provided
            if (insertId2 && Array.isArray(ebrigade_analytics) && ebrigade_analytics.length > 0) {
              for (const analyticName of ebrigade_analytics) {
                try {
                  await pool.query(
                    'INSERT INTO activity_ebrigade_mappings (activity_id, ebrigade_analytic_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [insertId2, analyticName]
                  )
                } catch (mappingErr) {
                  console.warn('[api/admin/activities] Failed to save mapping for', analyticName, mappingErr.message)
                }
              }
            }
            
            const selQ2 = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [insertId2])
            const row2 = (selQ2 && selQ2.rows && selQ2.rows[0]) ? selQ2.rows[0] : (Array.isArray(selQ2) ? selQ2[0] : null)
            return res.status(201).json({ item: { ...row2, ebrigade_activity_type: typeToSave } })
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
