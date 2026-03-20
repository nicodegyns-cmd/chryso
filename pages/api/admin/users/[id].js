const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req

  const pool = getPool()

  if (method === 'GET') {
    try {
      const [rows] = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id FROM users WHERE id = ?', [id])
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' })
      const u = rows[0]
      // return user as-is; `role` may be a comma-separated list of canonical codes
      return res.status(200).json({ user: u })
    } catch (err) {
      console.error('[api/admin/users/[id]] GET error', err)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = req.body || {}
    const { email, role, firstName, lastName, ninami, telephone, adresse, niss, bce, societe, compte, fonction, liaisonId } = body
    try {
      const normalizeRoles = (r) => {
        const items = Array.isArray(r) ? r.map(String) : (r ? String(r).split(',') : [])
        const mapped = items.map(it => {
          const v = (it||'').toString().toLowerCase()
          if (v.includes('infi') || v.includes('infirm')) return 'INFI'
          if (v.includes('med')) return 'MED'
          if (v === 'admin') return 'admin'
          if (v.includes('moder')) return 'moderator'
          return null
        }).filter(Boolean)
        return Array.from(new Set(mapped)).join(',') || null
      }
      const roleValue = normalizeRoles(role)
      await pool.query(
        `UPDATE users SET email = ?, role = ?, first_name = ?, last_name = ?, ninami = ?, telephone = ?, address = ?, niss = ?, bce = ?, company = ?, account = ?, fonction = ?, liaison_ebrigade_id = ?, updated_at = NOW() WHERE id = ?`,
        [
          email ? email.toLowerCase() : null,
          roleValue,
          firstName || null,
          lastName || null,
          ninami || null,
          telephone || null,
          adresse || null,
          niss || null,
          bce || null,
          societe || null,
          compte || null,
          fonction || null,
          liaisonId || null,
          id,
        ]
      )
      const [rows] = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id FROM users WHERE id = ?', [id])
      return res.status(200).json({ user: rows[0] })
    } catch (err) {
      console.error('[api/admin/users/[id]] PUT error', err)
      return res.status(500).json({ error: 'db_error', detail: err.message })
    }
  }

  if (method === 'DELETE') {
    try {
      await pool.query('DELETE FROM users WHERE id = ?', [id])
      return res.status(204).end()
    } catch (err) {
      console.error('[api/admin/users/[id]] DELETE error', err)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
  res.status(405).end(`Method ${method} Not Allowed`)
}
