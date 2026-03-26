import { verifyUser } from '../../../services/userStore'

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

    // Normalize role before returning to client
    let role = (user.role || 'user').toString()
    const low = role.toLowerCase()
    if (low.includes('infi') || low.includes('infirm')) role = 'INFI'
    else if (low.includes('med')) role = 'MED'
    else if (low === 'admin') role = 'admin'
    else if (low === 'comptabilite' || low.includes('comptable')) role = 'comptabilite'
    else role = 'user'

    // In a real app you would sign a JWT or session; here we return a dev token
    return res.status(200).json({
      token: 'dev-token-' + Math.random().toString(36).slice(2, 10),
      role,
      email: user.email,
      message: 'Login successful'
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
