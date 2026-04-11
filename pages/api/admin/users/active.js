import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, address, fonction, company, role, ninami, niss, bce, account
       FROM users
       WHERE is_active = 1
         AND onboarding_status = 'active'
         AND role IN ('INFI', 'MED')
       ORDER BY last_name ASC, first_name ASC`
    )

    const rows = result.rows || result[0] || []

    return res.status(200).json({
      items: rows.map(row => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        telephone: row.telephone,
        address: row.address,
        fonction: row.fonction,
        company: row.company,
        role: row.role,
        ninami: row.ninami,
        niss: row.niss,
        bce: row.bce,
        account: row.account,
      }))
    })
  } catch (error) {
    console.error('[API] Get active users error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch active users', details: error.message })
  }
}
