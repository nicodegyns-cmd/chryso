// pages/api/comptabilite/revert-to-billing.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { invoice_numbers } = req.body

  if (!Array.isArray(invoice_numbers) || invoice_numbers.length === 0) {
    return res.status(400).json({ error: 'invoice_numbers est requis' })
  }

  // Validate format: only allow YYYY-NNNNN strings to prevent injection
  const validPattern = /^[0-9]{4}-[0-9]+$/
  if (!invoice_numbers.every(n => typeof n === 'string' && validPattern.test(n))) {
    return res.status(400).json({ error: 'Format de numéro de facture invalide' })
  }

  if (invoice_numbers.length > 1000) {
    return res.status(400).json({ error: 'Trop de numéros de factures en une seule requête' })
  }

  try {
    const pool = getPool()

    // Compter d'abord les prestations affectées
    const countRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM prestations WHERE invoice_number = ANY($1) AND status = 'Facturé'`,
      [invoice_numbers]
    )
    const count = parseInt(countRes.rows[0]?.cnt || '0', 10)

    if (count === 0) {
      return res.status(200).json({ count: 0, message: 'Aucune prestation Facturée trouvée pour ces numéros de facture' })
    }

    // Remettre en attente : réinitialiser statut, pdf_url et invoice_number
    await pool.query(
      `UPDATE prestations
       SET status = 'Envoyé à la facturation',
           pdf_url = NULL,
           invoice_number = NULL
       WHERE invoice_number = ANY($1)
         AND status = 'Facturé'`,
      [invoice_numbers]
    )

    return res.status(200).json({ count, message: `${count} prestation(s) remise(s) en statut "Envoyé à la facturation"` })
  } catch (err) {
    console.error('[revert-to-billing]', err.message)
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message })
  }
}
