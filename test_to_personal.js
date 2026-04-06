require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'cerf.o2switch.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_FROM || 'fenix@nexio7.be',
    pass: process.env.SMTP_PASSWORD
  }
});

const testEmail = async () => {
  try {
    console.log('📧 Envoi test email vers boite personnelle...\n');
    
    const info = await transporter.sendMail({
      from: {
        name: 'Fenix',
        address: 'fenix@nexio7.be'
      },
      to: 'nicodegyns@live.be',  // Ta boite perso
      subject: '🧪 TEST LIVRAISON EMAIL - Vérifier inbox vs spam',
      html: `
        <h2>Test de délivrabilité</h2>
        <p>Si tu vois ce message:</p>
        <ul>
          <li>✅ <strong>INBOX</strong> = Bonne réputation IP</li>
          <li>❌ <strong>SPAM</strong> = Mauvaise réputation IP O2Switch</li>
        </ul>
        <p>Message ID: <code>${Date.now()}</code></p>
      `
    });

    console.log('✅ Email envoyé!');
    console.log(`Message ID: ${info.messageId}`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
};

testEmail();
