const { createUser, findUserByEmail } = require('./services/userStore')

async function main() {
  const email = 'nicodegyns@gmail.com'
  const password = '1234'
  try {
    const existing = findUserByEmail(email)
    if (existing) {
      console.log('Admin already exists:', existing.email)
      return
    }
    const user = await createUser({ email: email.toLowerCase(), password, role: 'admin' })
    console.log('Admin created:', user.email)
  } catch (err) {
    console.error('Error creating admin:', err.message)
  }
}

main()
