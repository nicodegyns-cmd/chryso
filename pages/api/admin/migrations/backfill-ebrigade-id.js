const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const pool = getPool()
  try {
    // Backfill ebrigade_id where missing using ebrigade_activity_code
    const updateQ = `UPDATE prestations SET ebrigade_id = ebrigade_activity_code
                     WHERE (ebrigade_id IS NULL OR trim(ebrigade_id) = '')
                       AND ebrigade_activity_code IS NOT NULL
                       AND trim(ebrigade_activity_code) <> ''`
    const u = await pool.query(updateQ)

    // Return a sample of affected rows for verification
    const s = await pool.query(`SELECT id, ebrigade_id, ebrigade_activity_code, date, user_id
                                FROM prestations
                                WHERE ebrigade_activity_code IS NOT NULL
                                ORDER BY id DESC LIMIT 50`)

    return res.status(200).json({ success: true, updated: u && u.rowCount ? u.rowCount : 0, sample: s.rows || [] })
  } catch (err) {
    console.error('[backfill-ebrigade-id] error', err)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
