const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  try {
    function parseDistributionField(d) {
      if (!d) return []
      if (Array.isArray(d)) return d
      if (Buffer.isBuffer(d)) d = d.toString('utf8')
      if (typeof d === 'string') {
        try {
          const parsed = JSON.parse(d)
          if (Array.isArray(parsed)) return parsed
        } catch (e) {}
        return d.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean)
      }
      return []
    }

    if (req.method === 'GET') {
      const q = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at FROM analytics ORDER BY id DESC')
      const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
      const mapped = rows.map(r => ({
        id: r.id,
        name: r.name,
        analytic: r.analytic_type,
        code: r.code,
        entite: r.entite,
        distribution: parseDistributionField(r.distribution),
        description: r.description,
        is_active: !!r.is_active,
        created_by: r.created_by,
        created_at: r.created_at
      }))
      return res.status(200).json({ items: mapped })
    }

    if (req.method === 'POST') {
      const { name, analytic, code, entite, distribution, description } = req.body || {}
      if (!name || !code) return res.status(400).json({ error: 'name and code required' })
      const cleanedCode = (code || '').toString().trim().toUpperCase()
      if (!/^[A-Z0-9_-]+$/.test(cleanedCode)) return res.status(400).json({ error: 'Invalid code format' })

      const distArr = Array.isArray(distribution) ? distribution : (typeof distribution === 'string' ? distribution.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean) : [])

      try {
        const result = await pool.query(
          'INSERT INTO analytics (name, analytic_type, code, entite, distribution, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [name, analytic || 'PDF', cleanedCode, entite || null, distArr.length ? JSON.stringify(distArr) : null, description || null]
        )

        const insertId = (result && result.rows && result.rows[0]) ? result.rows[0].id : null
        const q2 = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at FROM analytics WHERE id = $1', [insertId])
        const row = (q2 && q2.rows && q2.rows[0]) ? q2.rows[0] : null
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
        return res.status(201).json({ item })
      } catch (dbErr) {
        console.error('POST analytics DB error:', dbErr.message, dbErr.code)
        if (dbErr.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: `Code "${cleanedCode}" exists` })
        }
        throw dbErr
      }
    }

    res.setHeader('Allow', 'GET,POST')
    res.status(405).end('Method Not Allowed')
  } catch (err) {
    console.error('=== ANALYTICS API ERROR ===')
    console.error('Method:', req.method)
    console.error('Message:', err.message)
    console.error('Code:', err.code)
    res.status(500).json({ error: 'internal' })
  }
}
