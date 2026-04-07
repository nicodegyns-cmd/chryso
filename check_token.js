const { Pool } = require('pg')

const pool = new Pool({
  host: 'ay177071-001.eu.clouddb.ovh.net',
  port: 35230,
  user: 'fenix',
  password: 'Toulouse94',
  database: 'fenix',
  ssl: {
    rejectUnauthorized: false
  }
})

pool.query('SELECT id, email, password_reset_token FROM users WHERE id = 1', (err, result) => {
  if (err) {
    console.error('Error:', err)
  } else {
    const row = result.rows[0]
    console.log('ID:', row.id)
    console.log('Email:', row.email)
    console.log('Token:', row.password_reset_token)
    console.log('Token length:', row.password_reset_token?.length || 0)
    console.log('Contains "=":', row.password_reset_token?.includes('='))
  }
  pool.end()
})
