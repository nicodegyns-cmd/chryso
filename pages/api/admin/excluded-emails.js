// pages/api/admin/excluded-emails.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const q = await pool.query('SELECT * FROM excluded_invitation_emails ORDER BY created_at DESC')
      const rows = q.rows || q[0] || []
      return res.status(200).json(rows)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { email, reason, created_by } = req.body
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' })
    try {
      const q = await pool.query(
        `INSERT INTO excluded_invitation_emails (email, reason, created_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET reason=$2, created_by=$3
         RETURNING *`,
        [email.toLowerCase().trim(), reason || null, created_by || 'admin']
      )
      const rows = q.rows || q[0] || []
      return res.status(201).json(rows[0])
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'email required' })
    try {
      await pool.query('DELETE FROM excluded_invitation_emails WHERE LOWER(email) = LOWER($1)', [email])
      return res.status(200).json({ deleted: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
