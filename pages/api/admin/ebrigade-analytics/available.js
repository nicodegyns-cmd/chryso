import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Fetch all unique eBrigade analytics from unfilled activities, with their mappings if they exist
    const result = await pool.query(`
      SELECT DISTINCT
        COALESCE(eam.id, 0) as id,
        a.ebrigade_analytic_name,
        a.local_analytic_id,
        ana.code,
        ana.name
      FROM (
        SELECT DISTINCT
          e_libelle as ebrigade_analytic_name
        FROM prestations
        WHERE hours_infiemerie IS NULL AND hours_medecin IS NULL
      ) a
      LEFT JOIN ebrigade_analytics_mapping eam ON a.ebrigade_analytic_name = eam.ebrigade_analytic_name
      LEFT JOIN analytics ana ON eam.local_analytic_id = ana.id
      ORDER BY a.ebrigade_analytic_name ASC
    `)

    const availableAnalytics = result.rows || []
    
    return res.status(200).json({ analytics: availableAnalytics })
  } catch (error) {
    console.error('[ebrigade-analytics/available]', error.message)
    res.status(500).json({ error: error.message })
  }
}
