const { query } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, telephone, address, fonction, company, role, liaison_ebrigade_id, niss, bce, account, onboarding_status
       FROM users
       WHERE onboarding_status = $1
       ORDER BY created_at DESC`,
      ['pending_validation']
    )

    return res.status(200).json({
      items: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        telephone: row.telephone,
        address: row.address,
        fonction: row.fonction,
        company: row.company,
        role: row.role,
        liaison_ebrigade_id: row.liaison_ebrigade_id,
        niss: row.niss,
        bce: row.bce,
        account: row.account,
        onboarding_status: row.onboarding_status
      }))
    })
  } catch (error) {
    console.error('Get pending users error:', error)
    return res.status(500).json({ error: 'Failed to fetch pending users' })
  }
}
