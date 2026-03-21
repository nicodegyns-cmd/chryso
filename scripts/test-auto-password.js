const axios = require('axios')

const API_HOST = 'http://localhost:3000'

async function testAutoPasswordGeneration() {
  try {
    console.log('📝 Test 1: Créer un nouvel utilisateur avec mot de passe auto-généré...\n')

    // Create new user
    const createRes = await axios.post(`${API_HOST}/api/admin/users`, {
      email: `testuser-${Date.now()}@example.com`,
      role: 'INFI',
      firstName: 'Test',
      lastName: 'User',
      telephone: '0123456789',
    })

    const { user, plainPassword } = createRes.data
    console.log('✅ Utilisateur créé avec succès:')
    console.log(`   Email: ${user.email}`)
    console.log(`   Mot de passe généré: ${plainPassword}`)
    console.log(`   Rôle: ${user.role}\n`)

    // Try to login with the generated password
    console.log('📝 Test 2: Se connecter avec le mot de passe généré...\n')
    
    const loginRes = await axios.post(`${API_HOST}/api/auth/login`, {
      email: user.email,
      password: plainPassword,
    })

    const { token } = loginRes.data
    console.log('✅ Connexion réussie!')
    console.log(`   Token: ${token.substring(0, 20)}...\n`)

    // Change password
    console.log('📝 Test 3: Changer le mot de passe...\n')

    const newPassword = 'NewPassword123!'
    const changeRes = await axios.post(
      `${API_HOST}/api/admin/users/${user.id}/change-password`,
      {
        oldPassword: plainPassword,
        newPassword: newPassword,
      }
    )

    console.log('✅ Mot de passe changé avec succès!')
    console.log(`   Nouveau mot de passe: ${newPassword}\n`)

    // Try to login with new password
    console.log('📝 Test 4: Se connecter avec le nouveau mot de passe...\n')

    const loginRes2 = await axios.post(`${API_HOST}/api/auth/login`, {
      email: user.email,
      password: newPassword,
    })

    console.log('✅ Connexion avec nouveau mot de passe réussie!')
    console.log(`   Token: ${loginRes2.data.token.substring(0, 20)}...\n`)

    // Verify old password doesn't work
    console.log('📝 Test 5: Vérifier que l\'ancien mot de passe ne fonctionne plus...\n')

    try {
      await axios.post(`${API_HOST}/api/auth/login`, {
        email: user.email,
        password: plainPassword,
      })
      console.log('❌ ERREUR: L\'ancien mot de passe fonctionne encore!\n')
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('✅ L\'ancien mot de passe ne fonctionne plus (attendu)\n')
      } else {
        throw err
      }
    }

    console.log('🎉 Tous les tests sont passés avec succès!')
  } catch (err) {
    console.error('❌ Erreur:', err.response?.data || err.message)
    process.exit(1)
  }
}

testAutoPasswordGeneration()
