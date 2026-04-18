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
      `SELECT id, email, first_name, last_name, telephone, address, fonction, company, role, liaison_ebrigade_id, niss, bce, account, is_active, onboarding_status,
              (invitation_token IS NOT NULL AND (telephone IS NULL OR telephone = '')) AS never_connected
       FROM users
       WHERE is_active = 0
         AND onboarding_status IN ('pending_signup', 'pending_validation')
       ORDER BY created_at DESC`
    )
    
    const rows = result.rows || result[0] || []
    console.log('[API] pending-validation: fetched', rows.length, 'users')

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
        onboarding_status: row.onboarding_status,
        never_connected: row.never_connected === true || row.never_connected === 1
      }))
    })
  } catch (error) {
    console.error('[API] Get pending users error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch pending users', details: error.message })
  }
}
