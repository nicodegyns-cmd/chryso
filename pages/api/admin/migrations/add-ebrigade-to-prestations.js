const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    console.log('[add-ebrigade-to-prestations] Starting migration...')

    // Check which columns exist
    const q1 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prestations'
    `)
    const existingCols = (q1 && q1.rows) ? q1.rows.map(r => r.column_name) : []
    console.log('[add-ebrigade-to-prestations] Existing columns:', existingCols)

    const colsToAdd = [
      { name: 'ebrigade_personnel_id', type: 'BIGINT' },
      { name: 'ebrigade_personnel_name', type: 'VARCHAR(255)' },
      { name: 'ebrigade_activity_code', type: 'VARCHAR(100)' },
      { name: 'ebrigade_activity_name', type: 'VARCHAR(255)' },
      { name: 'ebrigade_activity_type', type: 'VARCHAR(255)' },
      { name: 'ebrigade_duration_hours', type: 'DECIMAL(8, 2)' },
      { name: 'ebrigade_start_time', type: 'TIME' },
      { name: 'ebrigade_end_time', type: 'TIME' }
    ]

    let added = 0
    for (const col of colsToAdd) {
      if (!existingCols.includes(col.name)) {
        try {
          await pool.query(`ALTER TABLE prestations ADD COLUMN ${col.name} ${col.type}`)
          console.log(`[add-ebrigade-to-prestations] Added column: ${col.name}`)
          added++
        } catch (err) {
          console.warn(`[add-ebrigade-to-prestations] Column ${col.name} might already exist:`, err.message)
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Migration complete. Added ${added} columns.`
    })
  } catch (err) {
    console.error('[add-ebrigade-to-prestations] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
