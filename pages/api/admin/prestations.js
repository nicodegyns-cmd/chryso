const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method === 'GET') {
      try {
        const q = await pool.query(
          `SELECT p.*, u.email AS user_email, u.first_name AS user_firstName, u.last_name AS user_lastName, an.name AS analytic_name, an.code AS analytic_code
           FROM prestations p
           LEFT JOIN users u ON p.user_id = u.id
           LEFT JOIN analytics an ON p.analytic_id = an.id
           ORDER BY p.id DESC`
        )
        const rows = (q && q.rows) ? q.rows : []
        return res.status(200).json({ items: rows })
      } catch (e) {
        console.warn('prestations query error', e && e.message)
        return res.status(200).json({ items: [] })
      }
    }

    if (req.method === 'POST') {
      const {
        user_email,
        email,
        analytic_id,
        date,
        pay_type,
        hours_actual,
        garde_hours,
        sortie_hours,
        overtime_hours,
        remuneration_infi,
        remuneration_med,
        comments,
        expense_amount,
        expense_comment,
        proof_image,
        status
      } = req.body || {}

      const userEmail = user_email || email
      if (!userEmail) {
        return res.status(400).json({ error: 'user_email required' })
      }

      // Find user by email
      const q1 = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [userEmail.toLowerCase()]
      )
      const users = (q1 && q1.rows) ? q1.rows : []
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const userId = users[0].id

      // Insert new prestation
      const q2 = await pool.query(
        `INSERT INTO prestations (
          user_id, analytic_id, date, pay_type,
          hours_actual, garde_hours, sortie_hours, overtime_hours,
          remuneration_infi, remuneration_med,
          comments, expense_amount, expense_comment, proof_image,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()) 
        RETURNING *`,
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

      const resultRows = (q2 && q2.rows) ? q2.rows : []
      const newRow = resultRows[0] || null

      if (!newRow) {
        return res.status(500).json({ error: 'Failed to insert prestation' })
      }

      return res.status(201).json(newRow)
    }

    if (req.method === 'PATCH') {
      const { id } = req.query
      const { pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, status } = req.body || {}

      const q = await pool.query(
        `UPDATE prestations SET
           pay_type = COALESCE($1, pay_type),
           hours_actual = COALESCE($2::numeric, hours_actual),
           garde_hours = COALESCE($3::numeric, garde_hours),
           sortie_hours = COALESCE($4::numeric, sortie_hours),
           overtime_hours = COALESCE($5::numeric, overtime_hours),
           remuneration_infi = COALESCE($6::numeric, remuneration_infi),
           remuneration_med = COALESCE($7::numeric, remuneration_med),
           comments = COALESCE($8, comments),
           expense_amount = COALESCE($9::numeric, expense_amount),
           expense_comment = COALESCE($10, expense_comment),
           proof_image = COALESCE($11, proof_image),
           analytic_id = COALESCE($12, analytic_id),
           status = COALESCE($13, status),
           updated_at = NOW()
         WHERE id = $14
         RETURNING *`,
        [pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, status, id]
      )

      const rows = (q && q.rows) ? q.rows : []
      const updated = rows[0] || null

      if (!updated) {
        return res.status(404).json({ error: 'Prestation not found' })
      }

      return res.status(200).json(updated)
    }

    res.setHeader('Allow', 'GET,POST,PATCH')
    res.status(405).end('Method Not Allowed')
  } catch (err) {
    console.error('prestations API error', err.message)
    res.status(500).json({ error: err.message || 'internal' })
  }
}
