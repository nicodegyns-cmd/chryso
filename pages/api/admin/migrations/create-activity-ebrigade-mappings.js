const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  
  const pool = getPool()
  try {
    console.log('[migration/create-activity-ebrigade-mappings] Starting migration...')
    
    // Create the activity_ebrigade_mappings table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_ebrigade_mappings (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        ebrigade_analytic_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(activity_id, ebrigade_analytic_name)
      )
    `)
    console.log('[migration/create-activity-ebrigade-mappings] Table created/verified')
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_ebrigade_mappings_activity_id 
      ON activity_ebrigade_mappings(activity_id)
    `)
    console.log('[migration/create-activity-ebrigade-mappings] Index created/verified')
    
    // Check how many records are in the table
    const [result] = await pool.query('SELECT COUNT(*) as count FROM activity_ebrigade_mappings')
    const count = result[0]?.count || 0
    
    console.log('[migration/create-activity-ebrigade-mappings] Table has', count, 'records')
    
    return res.status(200).json({
      success: true,
      message: 'activity_ebrigade_mappings table created/verified',
      recordCount: count
    })
  } catch (err) {
    console.error('[migration/create-activity-ebrigade-mappings] Error:', err)
    return res.status(500).json({
      success: false,
      error: err.message
    })
  }
}
