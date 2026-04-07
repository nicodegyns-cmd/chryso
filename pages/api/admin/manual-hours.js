import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    // Insert prestation manually
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
  } catch (err) {
    console.error('[manual-hours API] Error creating prestation:', err)
    return res.status(500).json({ message: 'Erreur lors de la création de la prestation', error: err.message })
  }
}
