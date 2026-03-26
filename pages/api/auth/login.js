import { verifyUser } from '../../../services/userStore'
import { query as dbQuery } from '../../../services/db'

export default async function handler(req, res) {
  console.log('[api/login] handler start', req.method)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    console.log('[api/login] verifying user', email)
    const user = await verifyUser(String(email).trim().toLowerCase(), password)
    console.log('[api/login] verifyUser returned', !!user)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    // Try to load roles from normalized tables (roles + user_roles)
    let dbRoles = []
    try {
      const rows = await dbQuery('SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?', [user.id])
      if (Array.isArray(rows) && rows.length > 0) dbRoles = rows.map(r => r.name)
    } catch (e) {
      // If the roles tables don't exist yet or query fails, we'll fallback to legacy column
      console.warn('[api/login] roles lookup failed, falling back to users.role', e.message)
      dbRoles = []
    }

    // Normalize roles (the `role` column can be comma-separated)
    const raw = (dbRoles.length > 0 ? dbRoles.join(',') : (user.role || 'user')).toString()
    const parts = raw.split(/[,;\s]+/).map(p => (p || '').toString()).filter(Boolean)
    const normalize = (r) => {
      const low = (r || '').toString().toLowerCase()
      if (low.includes('infi') || low.includes('infirm')) return 'INFI'
      if (low.includes('med')) return 'MED'
      if (low === 'admin') return 'admin'
      if (low === 'comptabilite' || low.includes('comptable')) return 'comptabilite'
      if (low.includes('moder')) return 'moderator'
      return 'user'
    }
    const roles = Array.from(new Set(parts.map(normalize)))
    const active = roles.length > 0 ? roles[0] : 'user'

    // In a real app you would sign a JWT or session; here we return a dev token
    return res.status(200).json({
      token: 'dev-token-' + Math.random().toString(36).slice(2, 10),
      role: active,
      roles,
      email: user.email,
      message: 'Login successful'
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
