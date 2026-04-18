export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'
    const configured = emailProvider === 'gmail' 
      ? !!(process.env.GMAIL_USER && process.env.GMAIL_PASSWORD)
      : emailProvider === 'sendgrid'
      ? !!process.env.SENDGRID_API_KEY
      : !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD)

    return res.status(200).json({
      configured,
      provider: emailProvider,
      fromEmail: process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@sirona-consult.be',
      message: configured 
        ? 'SMTP est configuré et prêt'
        : 'SMTP n\'est pas configuré - vérifiez les variables d\'environnement',
      env: {
        EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_FROM: process.env.SMTP_FROM,
        SMTP_SECURE: process.env.SMTP_SECURE,
        SMTP_USER: process.env.SMTP_USER ? '***configured***' : undefined,
        SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '***configured***' : undefined,
        GMAIL_USER: process.env.GMAIL_USER,
      }
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
