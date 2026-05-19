// pages/api/comptabilite/create-avoir.js
// Crée un avoir (note de crédit) lié à une prestation déjà facturée/payée
// Génère une prestation avec montant négatif, statut "Envoyé à la facturation"
// Elle sera incluse automatiquement dans le prochain export de facturation

const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = getPool()
  const { prestation_id, amount, reason } = req.body || {}

  if (!prestation_id) return res.status(400).json({ error: 'prestation_id requis' })
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Le montant de l\'avoir doit être positif' })
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'La raison de l\'avoir est requise' })

  try {
    // Fetch the original prestation
    const origRes = await pool.query(
      `SELECT p.id, p.user_id, p.analytic_id, p.invoice_number, p.pay_type,
              p.remuneration_infi, p.remuneration_med,
              u.email AS user_email, u.role AS user_role
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [prestation_id]
    )

    if (!origRes.rows || origRes.rows.length === 0) {
      return res.status(404).json({ error: 'Prestation introuvable' })
    }

    const orig = origRes.rows[0]
    const negAmount = -Math.abs(Number(amount))
    const today = new Date().toISOString().slice(0, 10)

    // Determine remuneration fields based on user role
    const isMed = (orig.user_role || '').toUpperCase().includes('MED')
    const remuInfi = isMed ? null : negAmount
    const remuMed = isMed ? negAmount : null

    // Ensure avoir-related columns exist
    try { await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS is_avoir BOOLEAN DEFAULT FALSE") } catch (e) {}

    const insertRes = await pool.query(
      `INSERT INTO prestations
         (user_id, analytic_id, date, status, pay_type, comments,
          remuneration_infi, remuneration_med,
          garde_hours, sortie_hours, hours_actual, overtime_hours,
          is_avoir, created_at, updated_at)
       VALUES ($1, $2, $3, 'Envoyé à la facturation', 'AVOIR', $4,
               $5, $6,
               0, 0, 0, 0,
               TRUE, NOW(), NOW())
       RETURNING id`,
      [
        orig.user_id,
        orig.analytic_id,
        today,
        reason.trim(),
        remuInfi,
        remuMed,
      ]
    )

    const newId = insertRes.rows[0].id
    console.log(`[create-avoir] Avoir #${newId} créé pour prestation #${prestation_id}, montant: ${negAmount}€, raison: ${reason}`)

    return res.status(200).json({
      success: true,
      avoir_id: newId,
      amount: negAmount,
      message: `Avoir créé avec succès (prestation #${newId}, ${negAmount}€). Il apparaîtra dans le prochain export de facturation.`
    })
  } catch (e) {
    console.error('[create-avoir] error:', e.message)
    return res.status(500).json({ error: 'Erreur serveur: ' + e.message })
  }
}
