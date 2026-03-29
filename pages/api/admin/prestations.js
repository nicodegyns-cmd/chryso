const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      // Try to select from prestations table; if it doesn't exist, return empty list
      try{
        const q_rows = await pool.query(
          `SELECT p.*, u.email AS user_email, u.first_name AS user_firstName, u.last_name AS user_lastName, an.name AS analytic_name, an.code AS analytic_code
           FROM prestations p
           LEFT JOIN users u ON p.user_id = u.id
           LEFT JOIN analytics an ON p.analytic_id = an.id
           ORDER BY p.id DESC`)
        return res.status(200).json({ items: rows })
      }catch(e){
        // If table missing, log and return empty
        console.warn('prestations query error', e && e.code)
        return res.status(200).json({ items: [] })
      }
    }

    if (req.method === 'POST'){
      // Create a new prestation
      const { 
        user_email, email,
        analytic_id, date, pay_type,
        hours_actual, garde_hours, sortie_hours, overtime_hours,
        remuneration_infi, remuneration_med,
        comments, expense_amount, expense_comment, proof_image,
        status
      } = req.body || {}

      const userEmail = user_email || email
      if (!userEmail) return res.status(400).json({ error: 'user_email required' })

      // Find user by email
      const q_users = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = ?',
        [(userEmail || '').toLowerCase()]
      )
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const userId = users[0].id

      // Insert new prestation
      const q_result = await pool.query(
        `INSERT INTO prestations (
          user_id, analytic_id, date, pay_type,
          hours_actual, garde_hours, sortie_hours, overtime_hours,
          remuneration_infi, remuneration_med,
          comments, expense_amount, expense_comment, proof_image,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()) RETURNING id`,
        [
          userId,
          analytic_id || null,
          date || null,
          pay_type || null,
          hours_actual || null,
          garde_hours || null,
          sortie_hours || null,
          overtime_hours || null,
          remuneration_infi || null,
          remuneration_med || null,
          comments || null,
          expense_amount || null,
          expense_comment || null,
          proof_image || null,
          status || 'A saisir'
        ]
      )

      const insertId = result.rows[0].id

      // Fetch and return the newly created prestation with user and analytic info
      const result_newRow_outer = await pool.query(
        `SELECT p.*, u.email AS user_email, u.role AS user_role, u.first_name AS user_first_name, u.last_name AS user_last_name, u.telephone AS user_phone, u.address AS user_address, u.bce AS user_bce, u.company AS company_name, u.account AS user_account, an.name AS analytic_name, an.code AS analytic_code
         FROM prestations p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN analytics an ON p.analytic_id = an.id
         WHERE p.id = ? LIMIT 1`,
        [insertId]
      )

      return res.status(201).json(newRow || { id: insertId })
    }

    res.setHeader('Allow', 'GET,POST')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('prestations API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
