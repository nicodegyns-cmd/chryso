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

    // Insert user with ADMIN role
    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, first_name, last_name`,
      [email, passwordHash, 'ADMIN', firstName, lastName, true]
    )

    const user = result.rows[0]
    console.log('✅ User created:', user)

    // Also add to user_roles table for visibility (if roles table exists)
    try {
      const rolesResult = await query(
        `SELECT id FROM roles WHERE role_name IN ('ADMIN', 'USER', 'MODERATOR')`,
        []
      )
      
      if (rolesResult.rows && rolesResult.rows.length > 0) {
        for (const role of rolesResult.rows) {
          await query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [user.id, role.id]
          )
        }
        console.log('✅ All roles assigned')
      }
    } catch (e) {
      console.log('ℹ️ user_roles not updated (table may not have roles)')
    }

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
