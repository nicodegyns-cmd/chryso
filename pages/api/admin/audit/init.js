import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Create acceptance audit log table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS acceptance_audit_log (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        email VARCHAR(254),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        accepted_cgu BOOLEAN DEFAULT false,
        accepted_privacy BOOLEAN DEFAULT false,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create index on email and user_id for faster queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_acceptance_audit_email ON acceptance_audit_log(email)
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_acceptance_audit_user_id ON acceptance_audit_log(user_id)
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_acceptance_audit_accepted_at ON acceptance_audit_log(accepted_at DESC)
    `)

    return res.status(200).json({ success: true, message: 'Audit table initialized' })
  } catch (error) {
    console.error('Init audit error:', error)
    return res.status(500).json({ error: 'Failed to initialize audit table', detail: error.message })
  }
}
