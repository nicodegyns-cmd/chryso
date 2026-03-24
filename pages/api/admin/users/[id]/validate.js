const { query } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    const { liaison_ebrigade_id, role, niss, bce, account } = req.body

    if (!id || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Update user: set liaison_ebrigade_id, role, and other admin fields, mark as active
    const result = await query(
      `UPDATE users
       SET liaison_ebrigade_id = $1,
           role = $2,
           niss = $3,
           bce = $4,
           account = $5,
           onboarding_status = $6,
           is_active = 1
       WHERE id = $7 AND onboarding_status = $8
       RETURNING id, email, first_name, last_name, role`,
      [liaison_ebrigade_id || null, role, niss || null, bce || null, account || null, 'active', parseInt(id), 'pending_validation']
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or already validated' })
    }

    const user = result.rows[0]
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Validate user error:', error)
    return res.status(500).json({ error: 'Failed to validate user' })
  }
}
