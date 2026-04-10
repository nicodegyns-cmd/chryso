import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Fetch users that are pending validation:
    // - Not active yet (is_active = 0)
    // - AND either haven't completed signup yet (pending_signup) OR completed signup but not validated (pending_validation)
    const result = await query(
      `SELECT id, email, first_name, last_name, telephone, address, fonction, company, role, city, postal_code, liaison_ebrigade_id, niss, bce, account, is_active, must_complete_profile, accepted_cgu, accepted_privacy, onboarding_status
       FROM users
       WHERE is_active = 0
         AND onboarding_status IN ('pending_signup', 'pending_validation')
       ORDER BY created_at DESC`
    )
    
    const rows = result.rows || result[0] || []

    return res.status(200).json({
      items: (rows || []).map(row => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        telephone: row.telephone,
        address: row.address,
        city: row.city,
        postal_code: row.postal_code,
        fonction: row.fonction,
        company: row.company,
        role: row.role,
        liaison_ebrigade_id: row.liaison_ebrigade_id,
        niss: row.niss,
        bce: row.bce,
        account: row.account,
        onboarding_status: 'pending_validation'
      }))
    })
  } catch (error) {
    console.error('Get pending users error:', error)
    return res.status(500).json({ error: 'Failed to fetch pending users' })
  }
}
