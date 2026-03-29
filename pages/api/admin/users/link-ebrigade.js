const { getPool } = require('../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  if (req.method === 'POST'){
    const { email, user_id, ebrigade_id } = req.body || {}
    if (!ebrigade_id) return res.status(400).json({ error: 'missing_ebrigade_id' })

    try{
      let q, params
      if (user_id){
        q = 'UPDATE users SET ebrigade_id = ? WHERE id = ?'
        params = [ebrigade_id, user_id]
      } else if (email){
        q = 'UPDATE users SET ebrigade_id = ? WHERE LOWER(email) = ?'
        params = [ebrigade_id, String(email).toLowerCase()]
      } else {
        return res.status(400).json({ error: 'missing_identifier' })
      }

      const q_result = await pool.query(q, params)
      if (result.affectedRows === 0) return res.status(404).json({ error: 'user_not_found' })

      // return the updated user row
      const q_rows = await pool.query('SELECT id, email, ebrigade_id FROM users WHERE ebrigade_id = ? LIMIT 1', [ebrigade_id])
      return res.status(200).json({ user: (rows && rows[0]) || null })
    }catch(err){
      console.error('[api/admin/users/link-ebrigade] error', err && err.message)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  if (req.method === 'GET'){
    const { ebrigade_id, email } = req.query || {}
    try{
      if (ebrigade_id){
        const q_rows = await pool.query('SELECT id, email, ebrigade_id FROM users WHERE ebrigade_id = ? LIMIT 1', [ebrigade_id])
        return res.status(200).json({ user: (rows && rows[0]) || null })
      }
      if (email){
        const q_rows = await pool.query('SELECT id, email, ebrigade_id FROM users WHERE LOWER(email) = ? LIMIT 1', [String(email).toLowerCase()])
        return res.status(200).json({ user: (rows && rows[0]) || null })
      }
      return res.status(400).json({ error: 'missing_query' })
    }catch(err){
      console.error('[api/admin/users/link-ebrigade] get error', err && err.message)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end('Method Not Allowed')
}
