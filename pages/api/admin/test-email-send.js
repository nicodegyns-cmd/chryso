import { send } from '../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.body

    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const result = await send({
      to: email,
      subject: '🧪 Fénix - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email</h2>
          <p>Cet email est un test d'envoi de la plateforme Fénix.</p>
          <p style="color: #666; font-size: 12px;">Envoyé le: ${new Date().toLocaleString()}</p>
        </div>
      `,
      text: 'Cet email est un test d\'envoi de la plateforme Fénix.'
    })

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message, sent: false })
  }
}
