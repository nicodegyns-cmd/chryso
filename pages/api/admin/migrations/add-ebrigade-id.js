const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    console.log('[add-ebrigade-id] Starting migration...')

    // Check if ebrigade_id column exists
    const q1 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prestations' AND column_name = 'ebrigade_id'
    `)
    const exists = (q1 && q1.rows && q1.rows.length > 0)

    if (exists) {
      return res.status(200).json({
        success: true,
        message: 'Column ebrigade_id already exists'
      })
    }

    // Add the column
    await pool.query(`ALTER TABLE prestations ADD COLUMN ebrigade_id VARCHAR(255)`)
    console.log('[add-ebrigade-id] Added column: ebrigade_id')

    return res.status(200).json({
      success: true,
      message: 'Column ebrigade_id added successfully'
    })
  } catch (err) {
    console.error('[add-ebrigade-id] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
