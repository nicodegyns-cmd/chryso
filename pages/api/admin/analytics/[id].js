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
      const [[row]] = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at, account_number FROM analytics WHERE id = $1', [id])
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
        created_at: row.created_at,
        account_number: row.account_number || null
      }
      return res.status(200).json({ item })
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, analytic, code, entite, distribution, description, is_active, account_number } = req.body || {}
      const updates = []
      const params = []
      let pi = 1
      if (typeof name !== 'undefined') { updates.push(`name = $${pi++}`); params.push(name) }
      if (typeof analytic !== 'undefined') { updates.push(`analytic_type = $${pi++}`); params.push(analytic) }
      if (typeof code !== 'undefined') { updates.push(`code = $${pi++}`); params.push((code||'').toString().trim().toUpperCase()) }
      if (typeof entite !== 'undefined') { updates.push(`entite = $${pi++}`); params.push(entite) }
      if (typeof distribution !== 'undefined') { updates.push(`distribution = $${pi++}`); params.push((Array.isArray(distribution) && distribution.length) ? JSON.stringify(distribution) : null) }
      if (typeof description !== 'undefined') { updates.push(`description = $${pi++}`); params.push(description) }
      if (typeof is_active !== 'undefined') { updates.push(`is_active = $${pi++}`); params.push(is_active ? 1 : 0) }
      if (typeof account_number !== 'undefined') { updates.push(`account_number = $${pi++}`); params.push(account_number || null) }

      if (updates.length === 0) return res.status(400).json({ error: 'no fields' })
      params.push(id)
      await pool.query("ALTER TABLE analytics ADD COLUMN IF NOT EXISTS account_number VARCHAR(64) DEFAULT NULL").catch(() => {})
      const sql = `UPDATE analytics SET ${updates.join(', ')} WHERE id = $${pi}`
      await pool.query(sql, params)
      const q2 = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at, account_number FROM analytics WHERE id = $1', [id])
      const row = (q2 && q2.rows && q2.rows[0]) ? q2.rows[0] : null
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
        created_at: row.created_at,
        account_number: row.account_number || null
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
