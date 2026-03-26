import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Some schemas use `onboarding_status`, others only have `is_active`.
    // Fetch users that appear not active (is_active = 0) as pending validation.
    const rows = await query(
      `SELECT id, email, first_name, last_name, telephone, address, fonction, company, role, liaison_ebrigade_id, niss, bce, account, is_active
       FROM users
       WHERE COALESCE(is_active, 0) = 0
       ORDER BY created_at DESC`
    )

    return res.status(200).json({
      items: (rows || []).map(row => ({
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
        onboarding_status: row.is_active ? 'active' : 'pending_validation'
      }))
    })
  } catch (error) {
    console.error('Get pending users error:', error)
    return res.status(500).json({ error: 'Failed to fetch pending users' })
  }
}
