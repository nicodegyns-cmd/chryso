const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'GET'){
      const [rows] = await pool.query('SELECT a.id, a.analytic_id, an.name as analytic_name, an.code as analytic_code, a.pay_type, a.date, a.remuneration_infi, a.remuneration_med, a.created_at FROM activities a LEFT JOIN analytics an ON a.analytic_id = an.id ORDER BY a.id DESC')
      return res.status(200).json({ items: rows })
    }

    if (req.method === 'POST'){
      const { analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med } = req.body || {}
      if (!analytic_id) return res.status(400).json({ error: 'analytic_id required' })
      const [result] = await pool.execute(
        'INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [analytic_id, analytic_name||null, analytic_code||null, pay_type||null, date||null, (typeof remuneration_infi !== 'undefined' ? remuneration_infi : null), (typeof remuneration_med !== 'undefined' ? remuneration_med : null)]
      )
      const insertId = result.insertId
      const [[row]] = await pool.query('SELECT id, analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med, created_at FROM activities WHERE id = ?', [insertId])
      return res.status(201).json({ item: row })
    }

    res.setHeader('Allow','GET,POST')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
