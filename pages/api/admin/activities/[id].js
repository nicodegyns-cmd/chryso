const { getPool } = require('../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query
  try{
    if (req.method === 'GET'){
      // Ensure overtime columns exist (defensive migration)
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_sortie_infi NUMERIC DEFAULT 0`).catch(()=>{})
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_sortie_med NUMERIC DEFAULT 0`).catch(()=>{})
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_overtime_infi NUMERIC DEFAULT 0`).catch(()=>{})
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS remuneration_overtime_med NUMERIC DEFAULT 0`).catch(()=>{})
      const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, remuneration_overtime_infi, remuneration_overtime_med, created_at FROM activities WHERE id = $1', [id])
      if (!row) return res.status(404).json({ error: 'not found' })
      
      // Get eBrigade name mappings
      let ebrigade_analytics = []
      try {
        const ebQ = await pool.query('SELECT ebrigade_analytic_name_pattern FROM activity_ebrigade_name_mappings WHERE activity_id = $1 ORDER BY ebrigade_analytic_name_pattern', [id])
        ebrigade_analytics = (ebQ && ebQ.rows) ? ebQ.rows.map(r => r.ebrigade_analytic_name_pattern) : []
      } catch (ebErr) {
        console.log('[api/admin/activities/[id]] activity_ebrigade_name_mappings table not available')
      }
      
      return res.status(200).json({ item: { ...row, ebrigade_analytics } })
    }

    if (req.method === 'PUT' || req.method === 'PATCH'){
      const { analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, remuneration_overtime_infi, remuneration_overtime_med, ebrigade_analytics } = req.body || {}
      const updates = []
      const params = []
      let paramIndex = 1
      if (typeof analytic_id !== 'undefined') { updates.push(`analytic_id = $${paramIndex++}`); params.push(analytic_id) }
      if (typeof analytic_name !== 'undefined') { updates.push(`analytic_name = $${paramIndex++}`); params.push(analytic_name) }
      if (typeof analytic_code !== 'undefined') { updates.push(`analytic_code = $${paramIndex++}`); params.push(analytic_code) }
      if (typeof pay_type !== 'undefined') { updates.push(`pay_type = $${paramIndex++}`); params.push(pay_type) }
      if (typeof date !== 'undefined') { updates.push(`date = $${paramIndex++}`); params.push(date) }
      if (typeof remuneration_infi !== 'undefined') { updates.push(`remuneration_infi = $${paramIndex++}`); params.push(remuneration_infi) }
      if (typeof remuneration_med !== 'undefined') { updates.push(`remuneration_med = $${paramIndex++}`); params.push(remuneration_med) }
      if (typeof remuneration_sortie_infi !== 'undefined') { updates.push(`remuneration_sortie_infi = $${paramIndex++}`); params.push(remuneration_sortie_infi) }
      if (typeof remuneration_sortie_med !== 'undefined') { updates.push(`remuneration_sortie_med = $${paramIndex++}`); params.push(remuneration_sortie_med) }
      if (typeof remuneration_overtime_infi !== 'undefined') { updates.push(`remuneration_overtime_infi = $${paramIndex++}`); params.push(remuneration_overtime_infi) }
      if (typeof remuneration_overtime_med !== 'undefined') { updates.push(`remuneration_overtime_med = $${paramIndex++}`); params.push(remuneration_overtime_med) }

      if (updates.length === 0 && (!Array.isArray(ebrigade_analytics))) return res.status(400).json({ error: 'no fields' })
      
      // Update activity records
      if (updates.length > 0) {
        params.push(id)
        const sql = `UPDATE activities SET ${updates.join(', ')} WHERE id = $${paramIndex}`
        await pool.query(sql, params)
      }
      
      // Update eBrigade mappings if provided (now by NAME patterns)
      if (Array.isArray(ebrigade_analytics)) {
        try {
          // First ensure table exists
          await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_ebrigade_name_mappings (
              id SERIAL PRIMARY KEY,
              activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
              ebrigade_analytic_name_pattern VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(activity_id, ebrigade_analytic_name_pattern)
            )
          `)
          
          // Delete old mappings for this activity
          await pool.query('DELETE FROM activity_ebrigade_name_mappings WHERE activity_id = $1', [id])
          
          // Insert new NAME-based mappings
          console.log('[api/admin/activities/[id]] Saving eBrigade name mappings for activity', id, ebrigade_analytics)
          for (const namePattern of ebrigade_analytics) {
            try {
              await pool.query(
                'INSERT INTO activity_ebrigade_name_mappings (activity_id, ebrigade_analytic_name_pattern) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, namePattern]
              )
              console.log('[api/admin/activities/[id]] Saved name mapping:', namePattern)
            } catch (mappingErr) {
              console.warn('[api/admin/activities/[id]] Failed to save name mapping for', namePattern, mappingErr.message)
            }
          }
        } catch (ebErr) {
          console.warn('[api/admin/activities/[id]] Failed to update eBrigade name mappings:', ebErr.message)
        }
      }
      
      const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med, remuneration_overtime_infi, remuneration_overtime_med, created_at FROM activities WHERE id = $1', [id])
      
      // Get eBrigade mappings for response
      let ebrigade_analytics_resp = []
      try {
        const ebQ = await pool.query('SELECT ebrigade_analytic_name_pattern FROM activity_ebrigade_name_mappings WHERE activity_id = $1 ORDER BY ebrigade_analytic_name_pattern', [id])
        ebrigade_analytics_resp = (ebQ && ebQ.rows) ? ebQ.rows.map(r => r.ebrigade_analytic_name_pattern) : []
      } catch (ebErr) {
        console.log('[api/admin/activities/[id]] activity_ebrigade_name_mappings table not available')
      }
      
      return res.status(200).json({ item: { ...row, ebrigade_analytics: ebrigade_analytics_resp } })
    }

    if (req.method === 'DELETE'){
      await pool.query('DELETE FROM activities WHERE id = $1', [id])
      return res.status(204).end()
    }

    res.setHeader('Allow','GET,PUT,PATCH,DELETE')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities/[id] API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
