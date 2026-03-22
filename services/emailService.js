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

    const appName = process.env.APP_NAME || 'Fénix'
    const appUrl = process.env.APP_URL || 'https://www.sirona-consult.be'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur ${appName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
      <h1 style="color: #0066cc; margin: 0; font-size: 28px;">Bienvenue sur ${appName}!</h1>
    </div>
    
    <p style="margin-top: 0;">Bonjour ${firstName || 'Utilisateur'},</p>
    
    <p>Un compte a été créé pour vous. Voici vos identifiants de connexion :</p>
    
    <div style="background-color: #f0f7ff; border-left: 4px solid #0066cc; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 8px 0;"><strong>Email :</strong></p>
      <p style="margin: 0 0 16px 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px;">${email}</p>
      
      <p style="margin: 8px 0;"><strong>Mot de passe temporaire :</strong></p>
      <p style="margin: 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; word-break: break-all;">${plainPassword}</p>
    </div>
    
    <h3 style="color: #0066cc; margin-top: 30px;">Procédure de connexion :</h3>
    <ol style="padding-left: 20px;">
      <li style="margin: 8px 0;">
        <a href="${appUrl}/login" style="color: #0066cc; text-decoration: none; font-weight: bold;">Connectez-vous</a> 
        avec votre email et le mot de passe temporaire
      </li>
      <li style="margin: 8px 0;">
        Accédez à votre 
        <a href="${appUrl}/profile" style="color: #0066cc; text-decoration: none; font-weight: bold;">profil</a>
      </li>
      <li style="margin: 8px 0;">Cliquez sur "Modifier mon mot de passe"</li>
      <li style="margin: 8px 0;">Définissez un nouveau mot de passe plus sécurisé</li>
    </ol>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ff9800; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #333;"><strong>⚠️ Important :</strong> Pour votre sécurité, veuillez changer ce mot de passe dès votre première connexion.</p>
    </div>
    
    <p style="color: #666; font-size: 13px; margin-top: 30px;">
      Si vous n'avez pas demandé la création de ce compte, veuillez ignorer cet email ou contacter l'administration.
    </p>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
      <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</p>
      <p style="margin: 4px 0;">Cet email a été envoyé automatiquement. Veuillez ne pas y répondre.</p>
    </div>
    
  </div>
</body>
</html>
    `.trim()

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

    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@sirona-consult.be'
    const domainFromEmail = fromEmail.split('@')[1] || 'sirona-consult.be'
    
    const info = await mailer.sendMail({
      from: {
        name: appName,
        address: fromEmail
      },
      to: email,
      subject: `Bienvenue sur ${appName} - Vos identifiants de connexion`,
      html: htmlContent,
      text: textContent,
      replyTo: fromEmail,
      headers: {
        'X-Mailer': 'Fénix/1.0',
        'X-Priority': '3 (Normal)',
        'Importance': 'normal',
        'Reply-To': fromEmail,
        'Content-Type': 'text/html; charset=UTF-8',
        'MIME-Version': '1.0',
        'Precedence': 'bulk',
        'List-ID': `<fenix-notifications.${domainFromEmail}>`,
        'List-Help': `<mailto:${fromEmail}?subject=help>`,
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All'
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
    const appName = process.env.APP_NAME || 'Fénix'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mot de passe modifié</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px;">
      <h1 style="color: #10b981; margin: 0; font-size: 28px;">Mot de passe modifié ✓</h1>
    </div>
    
    <p style="margin-top: 0;">Bonjour ${firstName || 'Utilisateur'},</p>
    
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #047857;"><strong>✓ Votre mot de passe a été modifié avec succès.</strong></p>
    </div>
    
    <p>Vous pouvez maintenant utiliser votre nouveau mot de passe pour vous connecter à votre compte.</p>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e;">
        <strong>Sécurité :</strong> Si vous n'avez pas effectué cette modification, veuillez 
        <strong>contacter immédiatement l'administration</strong> pour sécuriser votre compte.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
      <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</p>
      <p style="margin: 4px 0;">Cet email a été envoyé automatiquement. Veuillez ne pas y répondre.</p>
    </div>
    
  </div>
</body>
</html>
    `

    if (!mailer) {
      console.log('[EmailService] Password change confirmation would be sent to:', email)
      return { sent: false, error: 'SMTP not configured' }
    }

    const fromEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@sirona-consult.be'
    const domainFromEmail = fromEmail.split('@')[1] || 'sirona-consult.be'

    const info = await mailer.sendMail({
      from: {
        name: appName,
        address: fromEmail
      },
      to: email,
      subject: `${appName} - Mot de passe modifié`,
      html: htmlContent,
      replyTo: fromEmail,
      headers: {
        'X-Mailer': 'Fénix/1.0',
        'X-Priority': '3 (Normal)',
        'Importance': 'normal',
        'Reply-To': fromEmail,
        'Content-Type': 'text/html; charset=UTF-8',
        'MIME-Version': '1.0',
        'Precedence': 'bulk',
        'List-ID': `<fenix-notifications.${domainFromEmail}>`,
        'List-Help': `<mailto:${fromEmail}?subject=help>`,
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All'
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
