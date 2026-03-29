const { getPool } = require('../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

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
        return d.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
      }
      return []
    }

    const q = await pool.query('SELECT id, name, analytic_type, code, entite, distribution, description, is_active, created_by, created_at FROM analytics WHERE is_active = 1 ORDER BY id DESC')
    const rows = (q && q.rows) ? q.rows : []
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
  } catch (err) {
    console.error('public analytics API error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
