import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Fetch all unique eBrigade analytics from activities that haven't been filled
    const result = await pool.query(`
      SELECT DISTINCT 
         ebrigade_analytic_name,
        analytic_code,
        analytic_name
      FROM ebrigade_analytics_mapping eam
      LEFT JOIN analytics a ON eam.local_analytic_id = a.id
      ORDER BY ebrigade_analytic_name ASC
    `)

    const mappedAnalytics = result.rows || []
    
    return res.status(200).json({ analytics: mappedAnalytics })
  } catch (error) {
    console.error('[ebrigade-analytics/available]', error.message)
    res.status(500).json({ error: error.message })
  }
}
