import db from '../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await db.query(
      'SELECT id, first_name, last_name, email, role FROM users WHERE is_active = 1 ORDER BY first_name, last_name',
      []
    )

    return res.status(200).json({
      items: result.rows.map(row => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        role: row.role
      }))
    })
  } catch (error) {
    console.error('Get users error:', error)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
}
