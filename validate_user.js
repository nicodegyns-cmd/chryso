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

async function validateUser() {
  try {
    const result = await pool.query(
      `UPDATE users
       SET is_active = 1,
           must_complete_profile = false,
           onboarding_status = $1
       WHERE LOWER(email) = $2
       RETURNING id, email, first_name, last_name, is_active, must_complete_profile`,
      ['active', 'nicodegyns@gmail.com']
    )

    if (result.rows.length === 0) {
      console.log('❌ User not found')
    } else {
      const user = result.rows[0]
      console.log('\n✅ User validated successfully!')
      console.log('ID:', user.id)
      console.log('Email:', user.email)
      console.log('Name:', user.first_name, user.last_name)
      console.log('Is Active:', user.is_active)
      console.log('Must Complete Profile:', user.must_complete_profile)
    }
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await pool.end()
  }
}

validateUser()
