const { getPool } = require('../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      // Fetch available activities for users to fill in prestations
      const [rows] = await pool.query(`
        SELECT 
          a.id, 
          a.analytic_id, 
          an.name as analytic_name, 
          an.code as analytic_code, 
          a.pay_type, 
          a.date, 
          a.remuneration_infi, 
          a.remuneration_med, 
          a.created_at 
        FROM activities a 
        LEFT JOIN analytics an ON a.analytic_id = an.id 
        WHERE a.date >= CURRENT_DATE
        ORDER BY a.date ASC, a.created_at DESC
      `)
      console.log('Activities query result:', rows)
      return res.status(200).json({ activities: rows })
    }

    res.setHeader('Allow','GET')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities API error', err)
    res.status(500).json({ error: 'internal', message: err.message })
  }
}
