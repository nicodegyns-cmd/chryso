// Test script to check email sending
const nodemailer = require('nodemailer')

async function testEmail() {
  const config = {
    host: 'cerf.o2switch.net',
    port: 465,
    secure: true,
    auth: {
      user: 'fenix@nexio7.be',
      pass: '@Toulouse94'
    }
  }

  console.log('Creating transporter with config:')
  console.log('- Host:', config.host)
  console.log('- Port:', config.port)
  console.log('- Secure:', config.secure)
  console.log('- User:', config.auth.user)

  try {
    const transporter = nodemailer.createTransport(config)

    // Test connection
    console.log('\n1️⃣  Testing connection...')
    await transporter.verify()
    console.log('✅ Connection successful!')

    // Send test email
    console.log('\n2️⃣  Sending test email...')
    const info = await transporter.sendMail({
      from: {
        name: 'Fénix',
        address: 'fenix@nexio7.be'
      },
      to: 'nicodegyns@live.be',
      subject: '🧪 Test Email - Fénix Platform',
      html: '<h1>Test Email</h1><p>This is a test email from Fénix Platform with cleaned headers.</p>',
      text: 'Test email from Fénix',
      replyTo: 'fenix@nexio7.be',
      headers: {
        'X-Service': 'Fenix',
        'Precedence': 'bulk',
        'Auto-Submitted': 'auto-generated'
      }
    })

    console.log('✅ Email sent successfully!')
    console.log('- Message ID:', info.messageId)
    console.log('- Response:', info.response)
  } catch (err) {
    console.error('❌ Error:', err.message)
    if (err.code) console.error('- Error code:', err.code)
    if (err.command) console.error('- SMTP command:', err.command)
  }
}

testEmail()
