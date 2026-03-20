const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method !== 'GET'){
      res.setHeader('Allow', 'GET')
      return res.status(405).end('Method Not Allowed')
    }

    // Try to select from prestations table; if it doesn't exist, return empty list
    try{
      const [rows] = await pool.query(
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
  }catch(err){
    console.error('prestations API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
