const { getPool } = require('../../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query

  try{
    if (req.method !== 'GET'){
      res.setHeader('Allow', 'GET')
      return res.status(405).end('Method Not Allowed')
    }

    // Get send history for this analytic
    try{
      const [sends] = await pool.query(
        `SELECT id, sent_at, prestation_count, first_prestation_date, last_prestation_date, 
                recipient_emails, status, filename
         FROM pdf_sends
         WHERE analytic_id = ?
         ORDER BY sent_at DESC
         LIMIT 50`,
        [id]
      )

      // Parse JSON emails
      const formattedSends = sends.map(s => ({
        ...s,
        recipient_emails: JSON.parse(s.recipient_emails || '[]')
      }))

      return res.status(200).json({ items: formattedSends })
    }catch(queryErr){
      if (queryErr.code === 'ER_NO_SUCH_TABLE'){
        return res.status(200).json({ items: [] })
      }
      throw queryErr
    }
  }catch(err){
    console.error('get-send-history API error', err)
    res.status(500).json({ error: 'internal server error', message: err.message })
  }
}
