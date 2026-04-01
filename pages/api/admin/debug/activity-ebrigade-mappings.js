const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  try {
    const [rows] = await pool.query('SELECT * FROM activity_ebrigade_mappings')
    console.log('[debug] activity_ebrigade_mappings:', rows)
    return res.status(200).json({
      success: true,
      count: rows?.length || 0,
      data: rows || []
    })
  } catch (err) {
    console.error('[debug] Error:', err.message)
    return res.status(500).json({
      success: false,
      error: err.message
    })
  }
}
