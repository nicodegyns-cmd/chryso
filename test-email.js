const nodemailer = require('nodemailer')

async function testEmailConnection() {
  console.log('🔍 Test de connexion au serveur SMTP...\n')
  
  const config = {
    host: 'cerf.o2switch.net',
    port: 465,
    secure: true,
    auth: {
      user: 'fenix@nexio7.be',
      pass: '@Toulouse94'
    }
  }

  try {
    const transporter = nodemailer.createTransport(config)
    
    console.log('📧 Configuration:')
    console.log('   Serveur:', config.host)
    console.log('   Port:', config.port)
    console.log('   SSL/TLS: Activé')
    console.log('   Utilisateur:', config.auth.user)
    console.log('')
    
    console.log('⏳ Vérification de la connexion...')
    const verified = await transporter.verify()
    
    if (verified) {
      console.log('✅ SUCCÈS! La connexion au serveur SMTP est OK\n')
      console.log('✓ Les emails peuvent être envoyés via fenix@nexio7.be')
      console.log('✓ Serveur O2Switch (cerf.o2switch.net) est accessible')
      console.log('✓ Authentification réussie\n')
      console.log('📨 L\'application peut maintenant envoyer des emails!')
    } else {
      console.log('❌ ERREUR: La vérification de la connexion a échoué')
    }
  } catch (error) {
    console.log('❌ ERREUR de connexion:\n')
    console.log('Message:', error.message)
    console.log('Code:', error.code)
    console.log('\nVérifiez:')
    console.log('  1. Le serveur SMTP: cerf.o2switch.net')
    console.log('  2. Le port SMTP: 465')
    console.log('  3. L\'email: fenix@nexio7.be')
    console.log('  4. Le mot de passe: Toulouse94')
    console.log('  5. La connexion internet')
  }
}

testEmailConnection()
