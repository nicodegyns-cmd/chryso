import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const pool = getPool()

    const sql = `
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.company,
        u.role,
        u.address,
        u.niss,
        u.bce,
        u.account,
        u.fonction,
        u.ninami,
        u.telephone,
        u.is_active,
        -- latest RIB doc id/url/name/status
        (SELECT d.id FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_id,
        (SELECT d.url FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_url,
        (SELECT d.validation_status FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_status,
        -- latest fiche doc
        (SELECT d.id FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_id,
        (SELECT d.url FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_url,
        (SELECT d.validation_status FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_status
      FROM users u
      ORDER BY u.last_name ASC, u.first_name ASC
      LIMIT 2000
    `

    const result = await pool.query(sql)
    const rows = result.rows || result[0] || []
    return res.status(200).json({ success: true, users: rows })
  } catch (err) {
    console.error('[api/admin/prestataires] error', err)
    return res.status(500).json({ error: err.message })
  }
}
