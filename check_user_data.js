const { getPool } = require('./services/db')

async function check() {
  const pool = getPool()
  try {
    // Check user data
    const users = await pool.query('SELECT id, email, first_name, last_name FROM users WHERE email = $1', ['nicodegyns@gmail.com'])
    console.log('User:', JSON.stringify(users.rows, null, 2))

    // Check latest prestation
    const prestations = await pool.query(`
      SELECT p.id, p.user_id, p.user_email, u.email, u.first_name, u.last_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.user_email = $1
      ORDER BY p.id DESC
      LIMIT 1
    `, ['nicodegyns@gmail.com'])
    console.log('Last prestation:', JSON.stringify(prestations.rows, null, 2))
  } catch (e) {
    console.error('Error:', e.message)
  }
}
check()
