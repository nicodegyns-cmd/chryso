import { query } from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Ensure columns exist
    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS validated_by VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP DEFAULT NULL
    `)

    const result = await query(
      `SELECT id, email, first_name, last_name, role, validated_by, validated_at
       FROM users
       WHERE validated_by IS NOT NULL
       ORDER BY validated_at DESC
       LIMIT 100`
    )

    const rows = result.rows || []
    return res.status(200).json({
      items: rows.map(r => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        role: r.role,
        validated_by: r.validated_by,
        validated_at: r.validated_at,
      }))
    })
  } catch (error) {
    console.error('[API] validation-history error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch history', details: error.message })
  }
}
