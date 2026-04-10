import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get email from Authorization header (since token is dev-token)
    // The token format is 'Bearer <token>', but we'll extract email from query or assume it's in a cookie
    const email = req.query.email || req.body?.email

    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, liaison_ebrigade_id 
       FROM users 
       WHERE LOWER(email) = LOWER($1) AND is_active = true`,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = result.rows[0]
    res.status(200).json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      liaison_ebrigade_id: user.liaison_ebrigade_id
    })
  } catch (error) {
    console.error('Get user by token error:', error)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
}
