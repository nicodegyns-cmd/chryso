require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmail = async () => {
  console.log('\n📧 TEST SMTP DÉTAILLÉ\n');
  console.log('Paramètres:');
  console.log('- Host:', process.env.SMTP_HOST);
  console.log('- Port:', 465);
  console.log('- User:', process.env.SMTP_FROM);
  console.log('- Pass:', process.env.SMTP_PASSWORD ? '✅ Présent' : '❌ MANQUANT');
  console.log('');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'cerf.o2switch.net',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_FROM,
      pass: process.env.SMTP_PASSWORD
    },
    logger: true,
    debug: true
  });

  try {
    console.log('\n🔧 Test de verifyConnection...\n');
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('\n✅ SMTP CONNECTION SUCCESSFUL!\n');
      
      // Send test
      console.log('📤 Envoi email de test...\n');
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: 'nicodegyns@live.be',
        subject: 'TEST EMAIL VERBOSE',
        html: '<h1>Test Message</h1><p>Sent at: ' + new Date().toISOString() + '</p>'
      });

      console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
      console.log('Message ID:', info.messageId);
      console.log('Response:', info.response);
    } else {
      console.log('\n❌ SMTP CONNECTION FAILED!');
    }
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('\nFull error:', err);
  }
};

testEmail();
