const bcrypt = require('bcrypt')
const { query } = require('../services/db')

async function createUserGilles() {
  try {
    const email = 'gilles.thesin@hotmail.com'
    const password = '1234'
    const firstName = 'Gilles'
    const lastName = 'Thesin'

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert user with ADMIN role (is_active = 1 for smallint column)
    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, first_name, last_name`,
      [email, passwordHash, 'ADMIN', firstName, lastName, 1]
    )

    const user = result.rows[0]
    console.log('✅ User created:', user)

    console.log('\n✅ User ready!')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Role: ADMIN`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating user:', error.message)
    process.exit(1)
  }
}

createUserGilles()
