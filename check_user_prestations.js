const { getPool } = require('./services/db')
const pool = getPool()
pool.query(`
  SELECT u.id, u.email, COUNT(p.id) as n 
  FROM users u 
  LEFT JOIN prestations p ON p.user_id = u.id 
  GROUP BY u.id, u.email 
  ORDER BY n DESC 
  LIMIT 10
`).then(r => {
  r.rows.forEach(x => console.log('user_id:', x.id, '| email:', x.email, '| prestations:', x.n))
  process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
