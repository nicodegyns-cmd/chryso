const { getPool } = require('./services/db')

async function test() {
  const pool = getPool()
  try {
    const q = await pool.query(
      `SELECT p.id, p.user_id, p.user_email, u.email, u.first_name, u.last_name
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       LIMIT 5`
    )
    console.log(JSON.stringify(q.rows, null, 2))
  } catch (e) {
    console.error('Error:', e.message)
  }
}
test()
