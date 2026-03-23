const { getPool } = require('../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query
  try{
    if (req.method === 'GET'){
      const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [id])
      if (!row) return res.status(404).json({ error: 'not found' })
      return res.status(200).json({ item: row })
    }

    if (req.method === 'PUT' || req.method === 'PATCH'){
      const { analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med } = req.body || {}
      const updates = []
      const params = []
      if (typeof analytic_id !== 'undefined') { updates.push('analytic_id = ?'); params.push(analytic_id) }
      if (typeof analytic_name !== 'undefined') { updates.push('analytic_name = ?'); params.push(analytic_name) }
      if (typeof analytic_code !== 'undefined') { updates.push('analytic_code = ?'); params.push(analytic_code) }
      if (typeof pay_type !== 'undefined') { updates.push('pay_type = ?'); params.push(pay_type) }
      if (typeof date !== 'undefined') { updates.push('date = ?'); params.push(date) }
      if (typeof remuneration_infi !== 'undefined') { updates.push('remuneration_infi = ?'); params.push(remuneration_infi) }
      if (typeof remuneration_med !== 'undefined') { updates.push('remuneration_med = ?'); params.push(remuneration_med) }

      if (updates.length === 0) return res.status(400).json({ error: 'no fields' })
      params.push(id)
      const sql = `UPDATE activities SET ${updates.join(', ')} WHERE id = $1`
      await pool.execute(sql, params)
      const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = $1', [id])
      return res.status(200).json({ item: row })
    }

    if (req.method === 'DELETE'){
      await pool.execute('DELETE FROM activities WHERE id = $1', [id])
      return res.status(204).end()
    }

    res.setHeader('Allow','GET,PUT,PATCH,DELETE')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities/[id] API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
