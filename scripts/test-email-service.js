const { sendUserCreationEmail, sendPasswordChangeEmail } = require('../services/emailService')

async function testEmailService() {
  console.log('🔧 Testing Email Service\n')

  // Test 1: User creation email
  console.log('📧 Test 1: Sending user creation email...\n')
  const result1 = await sendUserCreationEmail(
    'test-user@example.com',
    'TestP@ssw0rd123',
    'Jean'
  )
  console.log('Result:', result1)

  // Small delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 2: Password change email
  console.log('\n📧 Test 2: Sending password change email...\n')
  const result2 = await sendPasswordChangeEmail(
    'test-user@example.com',
    'Jean'
  )
  console.log('Result:', result2)

  if (result1.sent && result2.sent) {
    console.log('\n✅ Both emails sent successfully!')
  } else {
    console.log('\n⚠️  Emails logged to console (SMTP not configured)')
    console.log('To enable email sending:')
    console.log('1. Set EMAIL_PROVIDER in .env (gmail, sendgrid, or smtp)')
    console.log('2. Configure credentials (GMAIL_USER/GMAIL_PASSWORD or SENDGRID_API_KEY, etc)')
    console.log('3. See EMAIL_CONFIG.md for setup instructions')
  }

  process.exit(0)
}

testEmailService().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
