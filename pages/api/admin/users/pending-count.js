// Get count of users who will be affected by eBrigade sync
const { query } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Count users with pending_signup status
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE onboarding_status = $1',
      ['pending_signup']
    )

    const pendingCount = parseInt(result.rows[0]?.count || 0)

    res.status(200).json({
      pendingCount,
      message: pendingCount === 0 
        ? 'Aucun profil en attente'
        : `${pendingCount} profil${pendingCount > 1 ? 's' : ''} en attente`
    })
  } catch (error) {
    console.error('Error getting pending count:', error)
    res.status(500).json({ error: 'Failed to get pending count', details: error.message })
  }
}
