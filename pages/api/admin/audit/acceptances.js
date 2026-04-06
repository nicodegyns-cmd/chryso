import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch acceptance audit log
    try {
      const rows = await query(`
        SELECT id, user_id, email, first_name, last_name, accepted_cgu, accepted_privacy, 
               accepted_at, ip_address
        FROM acceptance_audit_log
        ORDER BY accepted_at DESC
        LIMIT 1000
      `)

      return res.status(200).json({
        items: (rows || []).map(row => ({
          id: row.id,
          userId: row.user_id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          acceptedCgu: row.accepted_cgu,
          acceptedPrivacy: row.accepted_privacy,
          acceptedAt: row.accepted_at,
          ipAddress: row.ip_address,
        }))
      })
    } catch (error) {
      console.error('Fetch audit error:', error)
      return res.status(500).json({ error: 'Failed to fetch audit log' })
    }
  } else if (req.method === 'POST') {
    // Log an acceptance event
    try {
      const { userId, email, firstName, lastName, acceptedCgu, acceptedPrivacy } = req.body

      if (!userId || !email) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Get IP address from request headers
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()

      await query(`
        INSERT INTO acceptance_audit_log (user_id, email, first_name, last_name, accepted_cgu, accepted_privacy, accepted_at, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [userId, email, firstName || null, lastName || null, !!acceptedCgu, !!acceptedPrivacy, ip])

      return res.status(201).json({ success: true })
    } catch (error) {
      console.error('Log audit error:', error)
      return res.status(500).json({ error: 'Failed to log audit event' })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}
