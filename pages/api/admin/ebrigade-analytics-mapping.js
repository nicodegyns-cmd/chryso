import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    // For now, no token verification - admin access is assumed
    // In production, add proper authentication check

    if (req.method === 'GET') {
      // Get all mappings with analytics details
      const result = await pool.query(`
        SELECT 
          eam.id,
          eam.ebrigade_analytic_name,
          eam.local_analytic_id,
          a.code as analytic_code,
          a.name as analytic_name,
          eam.created_at,
          eam.updated_at
        FROM ebrigade_analytics_mapping eam
        LEFT JOIN analytics a ON eam.local_analytic_id = a.id
        ORDER BY eam.ebrigade_analytic_name
      `)
      return res.status(200).json({ mappings: result.rows || [] })
    }

    if (req.method === 'POST') {
      // Create or update mapping (upsert by ebrigade_analytic_name)
      const { ebrigade_analytic_name, local_analytic_id } = req.body
      
      if (!ebrigade_analytic_name || !local_analytic_id) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Verify the analytics ID exists
      const analyticsCheck = await pool.query(
        'SELECT id FROM analytics WHERE id = $1',
        [local_analytic_id]
      )
      if (analyticsCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Local analytic ID not found' })
      }

      const result = await pool.query(
        `INSERT INTO ebrigade_analytics_mapping (ebrigade_analytic_name, local_analytic_id)
         VALUES ($1, $2)
         ON CONFLICT (ebrigade_analytic_name) 
         DO UPDATE SET local_analytic_id = $2, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [ebrigade_analytic_name, local_analytic_id]
      )
      
      return res.status(201).json({ mapping: result.rows[0] })
    }

    if (req.method === 'PUT') {
      // Update mapping
      const { id, ebrigade_analytic_name, local_analytic_id } = req.body
      
      if (!id || !ebrigade_analytic_name || !local_analytic_id) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Verify the analytics ID exists
      const analyticsCheck = await pool.query(
        'SELECT id FROM analytics WHERE id = $1',
        [local_analytic_id]
      )
      if (analyticsCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Local analytic ID not found' })
      }

      const result = await pool.query(
        `UPDATE ebrigade_analytics_mapping 
         SET ebrigade_analytic_name = $1, local_analytic_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [ebrigade_analytic_name, local_analytic_id, id]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Mapping not found' })
      }

      return res.status(200).json({ mapping: result.rows[0] })
    }

    if (req.method === 'DELETE') {
      // Delete mapping
      const { id } = req.body
      
      if (!id) {
        return res.status(400).json({ error: 'ID required' })
      }

      const result = await pool.query(
        'DELETE FROM ebrigade_analytics_mapping WHERE id = $1 RETURNING id',
        [id]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Mapping not found' })
      }

      return res.status(200).json({ success: true, id: result.rows[0].id })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[ebrigade-analytics-mapping API]', error.message)
    res.status(500).json({ error: error.message })
  }
}
