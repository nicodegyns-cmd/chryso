import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const {
    user_id,
    date,
    hours_actual,
    garde_hours,
    sortie_hours,
    overtime_hours,
    activity_id,
    comments,
    pay_type
  } = req.body

  if (!user_id || !date) {
    return res.status(400).json({ message: 'user_id et date sont obligatoires' })
  }

  const pool = getPool()

  try {
    if (req.method === 'POST') {
      // Create new prestation
      const insertQuery = `
        INSERT INTO prestations (
          user_id,
          date,
          hours_actual,
          garde_hours,
          sortie_hours,
          overtime_hours,
          activity_id,
          comments,
          pay_type,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'En attente', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id, user_id, date, hours_actual, garde_hours, sortie_hours, overtime_hours, status, created_at
      `

      const result = await pool.query(insertQuery, [
        user_id,
        date,
        hours_actual || null,
        garde_hours || null,
        sortie_hours || null,
        overtime_hours || null,
        activity_id || null,
        comments || null,
        pay_type || 'Normal'
      ])

      const prestation = result.rows[0]

      return res.status(201).json({
        message: 'Heures enregistrées avec succès',
        prestation
      })
    } else if (req.method === 'PUT') {
      // Update existing prestation
      const { id } = req.query

      if (!id) {
        return res.status(400).json({ message: 'id est obligatoire pour la modification' })
      }

      const updateQuery = `
        UPDATE prestations
        SET
          date = $2,
          hours_actual = $3,
          garde_hours = $4,
          sortie_hours = $5,
          overtime_hours = $6,
          activity_id = $7,
          comments = $8,
          pay_type = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, user_id, date, hours_actual, garde_hours, sortie_hours, overtime_hours, status, updated_at
      `

      const result = await pool.query(updateQuery, [
        id,
        date,
        hours_actual || null,
        garde_hours || null,
        sortie_hours || null,
        overtime_hours || null,
        activity_id || null,
        comments || null,
        pay_type || 'Normal'
      ])

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Prestation non trouvée' })
      }

      const prestation = result.rows[0]

      return res.status(200).json({
        message: 'Heures modifiées avec succès',
        prestation
      })
    }
  } catch (err) {
    console.error('[manual-hours API] Error:', err)
    return res.status(500).json({ message: 'Erreur lors du traitement de la prestation', error: err.message })
  }
}
