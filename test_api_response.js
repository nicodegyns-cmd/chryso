// Test what /api/admin/users returns for nicodegyns
const fetch = require('node-fetch')

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/admin/users')
    const data = await res.json()
    
    const list = data.users || []
    console.log('Total users:', list.length)
    
    // Find nicodegyns
    const user = list.find(u => (u.email || '').toLowerCase().includes('nicodegyns@live.be'))
    
    if (user) {
      console.log('\nFound user:')
      console.log('Email:', user.email)
      console.log('is_active type:', typeof user.is_active)
      console.log('is_active value:', user.is_active)
      console.log('is_active === 1:', user.is_active === 1)
      console.log('is_active === true:', user.is_active === true)
      console.log('Full user object:', JSON.stringify(user, null, 2))
    } else {
      console.log('User not found - listing all users:')
      list.slice(0, 5).forEach(u => {
        console.log(`- ${u.email}: is_active=${u.is_active} (type: ${typeof u.is_active})`)
      })
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

test()
