import { verifyUser } from '../../../services/userStore'
import { query as dbQuery, getPool } from '../../../services/db'

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

    // If account not active yet, allow login only when user must complete profile
    // (first-login with temporary password). Otherwise block access.
    if (!user.is_active && !user.must_complete_profile) {
      return res.status(403).json({ error: 'account_pending', message: 'Votre compte est en attente de validation par l\'administration' })
    }

    // Try to load roles from normalized tables (roles + user_roles)
    let dbRoles = []
    try {
      const rolesSql = 'SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?'
      console.log('[SQL DEBUG] roles lookup', rolesSql, [user.id])
      const qRoles = await dbQuery(rolesSql, [user.id])
      const rows = Array.isArray(qRoles) ? qRoles : (qRoles && qRoles.rows) ? qRoles.rows : []
      if (Array.isArray(rows) && rows.length > 0) {
        dbRoles = rows.map(r => r.name)
        console.log('[api/login] loaded', dbRoles.length, 'roles from user_roles')
      }
    } catch (e) {
      // If the roles tables don't exist yet or query fails, we'll fallback to legacy column
      console.warn('[api/login] roles lookup failed (expected if migration not run yet), falling back to users.role:', e.message)
      dbRoles = []
    }

    // Normalize roles (the `role` column can be comma-separated)
    const raw = dbRoles.length > 0 ? dbRoles.join(',') : (user.role || 'user')
    console.log('[api/login] raw role value:', raw)
    const parts = String(raw).split(/[,;\s]+/).map(p => (p || '').trim()).filter(p => p.length > 0)
    console.log('[api/login] role parts after split:', parts)
    
    const normalize = (r) => {
      const low = (r || '').toString().toLowerCase().trim()
      if (!low) return null
      if (low.includes('infi') || low.includes('infirm')) return 'INFI'
      if (low.includes('med')) return 'MED'
      if (low === 'admin') return 'admin'
      if (low === 'comptabilite' || low.includes('comptab')) return 'comptabilite'
      if (low.includes('moder')) return 'moderator'
      if (low === 'user') return 'user'
      // Default to 'user' for unrecognized roles instead of silently dropping them
      console.warn('[api/login] unrecognized role:', r, '-> defaulting to user')
      return 'user'
    }
    
    const roles = Array.from(new Set(parts.map(normalize).filter(r => r !== null)))
    console.log('[api/login] normalized roles:', roles)
    const active = roles.length > 0 ? roles[0] : 'user'
    console.log('[api/login] active role:', active)

    // Log successful login to login_history
    try {
      const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
      const ua = req.headers['user-agent'] || null
      // Fetch first_name/last_name (not returned by verifyUser)
      const pool = getPool()
      const nameQ = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [user.id])
      const nameRow = (nameQ.rows || nameQ[0] || [])[0] || {}
      await pool.query(
        `INSERT INTO login_history (user_id, email, first_name, last_name, role, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, user.email, nameRow.first_name || null, nameRow.last_name || null, active, ip || null, ua]
      )
    } catch (e) {
      console.warn('[api/login] Failed to log login history:', e.message)
    }

    // In a real app you would sign a JWT or session; here we return a dev token
    return res.status(200).json({
      token: 'dev-token-' + Math.random().toString(36).slice(2, 10),
      id: user.id,
      role: active,
      roles,
      email: user.email,
      must_complete_profile: !!user.must_complete_profile,
      accepted_cgu: !!user.accepted_cgu,
      accepted_privacy: !!user.accepted_privacy,
      message: 'Login successful'
    })
  } catch (err) {
    console.error('[api/login] error:', err)
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
