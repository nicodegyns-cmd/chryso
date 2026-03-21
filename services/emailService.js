const nodemailer = require('nodemailer')

// Helper to get email configuration from environment
function getEmailConfig() {
  // Support both specific SMTP config and Gmail
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'

  if (emailProvider === 'gmail') {
    return {
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    }
  } else if (emailProvider === 'sendgrid') {
    // SendGrid SMTP settings
    return {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    }
  } else {
    // Generic SMTP configuration
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }
  }
}

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  const config = getEmailConfig()

  // Only create transporter if we have minimal config
  if (!config.auth?.user || !config.auth?.pass) {
    console.warn('[EmailService] SMTP not configured - emails will be logged only')
    return null
  }

  transporter = nodemailer.createTransport(config)
  return transporter
}

/**
 * Send email to new user with credentials
 * @param {string} email - User email
 * @param {string} plainPassword - Generated password
 * @param {string} firstName - User first name
 * @returns {Promise<{sent: boolean, messageId?: string, error?: string}>}
 */
async function sendUserCreationEmail(email, plainPassword, firstName) {
  try {
    const mailer = getTransporter()

    const appName = process.env.APP_NAME || 'Chryso'
    const appUrl = process.env.APP_URL || 'https://www.sirona-consult.be'

    const htmlContent = `
      <h2>Bienvenue sur ${appName}!</h2>
      
      <p>Bonjour ${firstName || 'Utilisateur'},</p>
      
      <p>Un compte a été créé pour vous avec les identifiants suivants:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mot de passe temporaire:</strong> <code style="background: #fff; padding: 5px; border-radius: 3px;">${plainPassword}</code></p>
      </div>
      
      <h3>Procédure:</h3>
      <ol>
        <li><a href="${appUrl}/login">Connectez-vous</a> avec votre email et le mot de passe temporaire</li>
        <li>Accédez à votre <a href="${appUrl}/profile">profil</a></li>
        <li>Cliquez sur "Modifier mon mot de passe"</li>
        <li>Définissez un nouveau mot de passe plus sécurisé</li>
      </ol>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        <strong>Important:</strong> Pour votre sécurité, veuillez changer ce mot de passe dès votre première connexion.
      </p>
      
      <p style="color: #666; font-size: 12px;">
        Si vous n'avez pas demandé la création de ce compte, veuillez ignorer cet email ou contacter l'administration.
      </p>
    `

    const textContent = `
Bienvenue sur ${appName}!

Bonjour ${firstName || 'Utilisateur'},

Un compte a été créé pour vous avec les identifiants suivants:

Email: ${email}
Mot de passe temporaire: ${plainPassword}

Procédure:
1. Connectez-vous avec votre email et le mot de passe temporaire
2. Accédez à votre profil
3. Cliquez sur "Modifier mon mot de passe"
4. Définissez un nouveau mot de passe plus sécurisé

Important: Pour votre sécurité, veuillez changer ce mot de passe dès votre première connexion.

Si vous n'avez pas demandé la création de ce compte, veuillez ignorer cet email ou contacter l'administration.
    `.trim()

    if (!mailer) {
      // Log email to console if SMTP not configured
      console.log('[EmailService] Email would be sent:')
      console.log('To:', email)
      console.log('Subject: Bienvenue sur ' + appName)
      console.log('Body:', textContent)
      console.log('---')
      return { sent: false, error: 'SMTP not configured - logged to console only' }
    }

    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@sirona-consult.be'
    
    const info = await mailer.sendMail({
      from: {
        name: appName,
        address: fromEmail
      },
      to: email,
      subject: `Bienvenue sur ${appName} - Vos identifiants de connexion`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Mailer': 'Chryso',
        'X-Priority': '3',
        'Importance': 'normal',
        'Reply-To': fromEmail
      }
    })

    console.log('[EmailService] Email sent:', { email, messageId: info.messageId })
    return { sent: true, messageId: info.messageId }
  } catch (err) {
    console.error('[EmailService] Error sending email:', err.message)
    return { sent: false, error: err.message }
  }
}

/**
 * Send password change confirmation email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendPasswordChangeEmail(email, firstName) {
  try {
    const mailer = getTransporter()
    const appName = process.env.APP_NAME || 'Chryso'

    const htmlContent = `
      <h2>Mot de passe modifié</h2>
      
      <p>Bonjour ${firstName || 'Utilisateur'},</p>
      
      <p>Votre mot de passe a été modifié avec succès.</p>
      
      <p>Si vous n'avez pas effectué cette modification, veuillez contacter immédiatement l'administration.</p>
    `

    if (!mailer) {
      console.log('[EmailService] Password change confirmation would be sent to:', email)
      return { sent: false, error: 'SMTP not configured' }
    }

    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@sirona-consult.be'

    const info = await mailer.sendMail({
      from: {
        name: appName,
        address: fromEmail
      },
      to: email,
      subject: `${appName} - Mot de passe modifié`,
      html: htmlContent,
      headers: {
        'X-Mailer': 'Chryso',
        'X-Priority': '3',
        'Importance': 'normal',
        'Reply-To': fromEmail
      }
    })

    console.log('[EmailService] Password change email sent:', { email, messageId: info.messageId })
    return { sent: true, messageId: info.messageId }
  } catch (err) {
    console.error('[EmailService] Error sending password change email:', err.message)
    return { sent: false, error: err.message }
  }
}

module.exports = {
  sendUserCreationEmail,
  sendPasswordChangeEmail,
}
