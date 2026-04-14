import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = req.query.token

    if (!token) {
      return res.status(400).json({ error: 'Token required' })
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, liaison_ebrigade_id 
       FROM users 
       WHERE invitation_token = $1
         AND invitation_expires_at > NOW()
         AND onboarding_status = 'pending_signup'`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired token' })
    }

    const user = result.rows[0]
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        liaison_ebrigade_id: user.liaison_ebrigade_id
      }
    })
  } catch (error) {
    console.error('Get user by token error:', error)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
}
