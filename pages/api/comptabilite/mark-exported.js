// pages/api/comptabilite/mark-exported.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { analytic_id, prestationIds } = req.body

    if (!analytic_id || !prestationIds || prestationIds.length === 0) {
      return res.status(400).json({ error: 'Missing analytic_id or prestationIds' })
    }

    // Update prestations status to "Facturé" (encoded/exported)
    const sql = `
      UPDATE prestations 
      SET status = 'Facturé'
      WHERE analytic_id = $1 AND id = ANY($2)
      RETURNING id, status
    `
    
    const result = await pool.query(sql, [analytic_id, prestationIds])
    const updated = result.rows || []

    res.status(200).json({
      success: true,
      updated: updated.length,
      message: `${updated.length} prestation${updated.length > 1 ? 's' : ''} marquée${updated.length > 1 ? 's' : ''} comme facturée`
    })
  } catch (err) {
    console.error('[mark-exported]', err)
    res.status(500).json({ error: err.message })
  }
}
