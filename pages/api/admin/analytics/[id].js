const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  const { id } = req.query
  try {
    function parseDistributionField(d) {
      if (!d) return []
      if (Array.isArray(d)) return d
      if (Buffer.isBuffer(d)) d = d.toString('utf8')
      if (typeof d === 'string') {
        try { const parsed = JSON.parse(d); if (Array.isArray(parsed)) return parsed } catch(e){}
        return d.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean)
      }
      return []
    }
    if (req.method === 'GET') {
      const [[row]] = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at FROM analytics WHERE id = $1', [id])
      if (!row) return res.status(404).json({ error: 'not found' })
      const item = {
        id: row.id,
        name: row.name,
        analytic: row.analytic_type,
        code: row.code,
        entite: row.entite,
        distribution: parseDistributionField(row.distribution),
        description: row.description,
        is_active: !!row.is_active,
        created_by: row.created_by,
        created_at: row.created_at
      }
      return res.status(200).json({ item })
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, analytic, code, entite, distribution, description, is_active } = req.body || {}
      const updates = []
      const params = []
      if (typeof name !== 'undefined') { updates.push('name = ?'); params.push(name) }
      if (typeof analytic !== 'undefined') { updates.push('analytic_type = ?'); params.push(analytic) }
      if (typeof code !== 'undefined') { updates.push('code = ?'); params.push((code||'').toString().trim().toUpperCase()) }
      if (typeof entite !== 'undefined') { updates.push('entite = ?'); params.push(entite) }
      if (typeof distribution !== 'undefined') { updates.push('distribution = ?'); params.push((Array.isArray(distribution) && distribution.length) ? JSON.stringify(distribution) : null) }
      if (typeof description !== 'undefined') { updates.push('description = ?'); params.push(description) }
      if (typeof is_active !== 'undefined') { updates.push('is_active = ?'); params.push(is_active ? 1 : 0) }

      if (updates.length === 0) return res.status(400).json({ error: 'no fields' })
      params.push(id)
      const sql = `UPDATE analytics SET ${updates.join(', ')} WHERE id = $1`
      await pool.execute(sql, params)
      const [[row]] = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at FROM analytics WHERE id = $1', [id])
      const item = {
        id: row.id,
        name: row.name,
        analytic: row.analytic_type,
        code: row.code,
        entite: row.entite,
        distribution: parseDistributionField(row.distribution),
        description: row.description,
        is_active: !!row.is_active,
        created_by: row.created_by,
        created_at: row.created_at
      }
      return res.status(200).json({ item })
    }

    if (req.method === 'DELETE') {
      await pool.execute('DELETE FROM analytics WHERE id = $1', [id])
      return res.status(204).end()
    }

    res.setHeader('Allow', 'GET,PUT,PATCH,DELETE')
    res.status(405).end('Method Not Allowed')
  } catch (err) {
    console.error('analytics/[id] API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
