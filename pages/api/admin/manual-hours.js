import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

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

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

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

    const result = await client.query(insertQuery, [
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

    await client.query('COMMIT')

    const prestation = result.rows[0]

    return res.status(201).json({
      message: 'Heures enregistrées avec succès',
      prestation
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error creating prestation:', err)
    return res.status(500).json({ message: 'Erreur lors de la création de la prestation', error: err.message })
  } finally {
    client.release()
  }
}
