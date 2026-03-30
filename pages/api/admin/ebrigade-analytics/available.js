import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Load all mappings from database
    const mappingsResult = await pool.query(`
      SELECT eam.id, eam.ebrigade_analytic_name, eam.local_analytic_id, a.code, a.name
      FROM ebrigade_analytics_mapping eam
      LEFT JOIN analytics a ON eam.local_analytic_id = a.id
      ORDER BY eam.ebrigade_analytic_name ASC
    `)
    const mappings = mappingsResult.rows || []
    
    return res.status(200).json({ analytics: mappings })
  } catch (error) {
    console.error('[ebrigade-analytics/available]', error.message)
    res.status(500).json({ error: error.message })
  }
}
