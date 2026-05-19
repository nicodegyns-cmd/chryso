// pages/api/comptabilite/avoirs.js
// Retourne tous les avoirs (notes de crédit) créés, avec les infos prestataire et prestation originale

import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = getPool()

  try {
    // Ensure original_prestation_id column exists (idempotent)
    await pool.query('ALTER TABLE prestations ADD COLUMN IF NOT EXISTS original_prestation_id BIGINT')

    const result = await pool.query(`
      SELECT
        p.id,
        p.date,
        p.created_at,
        p.status,
        p.comments        AS reason,
        p.invoice_number,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS amount,
        p.original_prestation_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role            AS user_role,
        COALESCE(a.name, 'Non assigné') AS analytic_name,
        -- original prestation info
        orig.date         AS orig_date,
        orig.invoice_number AS orig_invoice_number,
        orig.status       AS orig_status
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      LEFT JOIN prestations orig ON orig.id = p.original_prestation_id
      WHERE p.is_avoir = TRUE OR p.pay_type = 'AVOIR'
      ORDER BY p.created_at DESC
    `)

    return res.status(200).json({ avoirs: result.rows })
  } catch (e) {
    console.error('[avoirs] error:', e.message)
    return res.status(500).json({ error: 'Erreur serveur: ' + e.message })
  }
}
