import { getPool } from '../../../services/db'
import { sendEmail } from '../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { recipientType, recipientId, recipientRole, subject, message } = req.body
    const pool = getPool()

    // Validation
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Sujet et message sont requis' })
    }

    let recipients = []

    if (recipientType === 'individual' && recipientId) {
      // Get single user
      const [user] = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
        [recipientId]
      )
      if (user && user.length > 0) {
        recipients.push(user[0])
      } else {
        return res.status(404).json({ error: 'Utilisateur non trouvé' })
      }
    } else if (recipientType === 'role' && recipientRole) {
      // Get all users with the role
      const [users] = await pool.query(
        `SELECT id, email, first_name, last_name, role FROM users`
      )
      recipients = users.filter(u => {
        try {
          const roles = typeof u.role === 'string' ? JSON.parse(u.role) : (Array.isArray(u.role) ? u.role : [u.role])
          return roles.includes(recipientRole)
        } catch (e) {
          return u.role === recipientRole
        }
      })
    } else {
      return res.status(400).json({ error: 'Type de destinataire ou sélection invalide' })
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Aucun destinataire trouvé' })
    }

    // Send emails
    let sentCount = 0
    let failedCount = 0
    const errors = []

    for (const recipient of recipients) {
      try {
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Bonjour ${recipient.first_name || ''} ${recipient.last_name || ''},</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            <p style="color: #6b7280; font-size: 12px;">
              Cordialement,<br>
              L'équipe administrative
            </p>
          </div>
        `

        const result = await sendEmail({
          to: recipient.email,
          subject: subject,
          html: emailBody,
        })

        if (result.sent) {
          sentCount++
        } else {
          failedCount++
          errors.push(`${recipient.email}: ${result.error}`)
        }
      } catch (err) {
        failedCount++
        errors.push(`${recipient.email}: ${err.message}`)
      }
    }

    return res.status(200).json({
      success: true,
      message: `Message envoyé à ${sentCount} destinataire${sentCount !== 1 ? 's' : ''}${failedCount > 0 ? ` (${failedCount} erreur${failedCount !== 1 ? 's' : ''})` : ''}`,
      stats: {
        total: recipients.length,
        sent: sentCount,
        failed: failedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Send message error:', error)
    return res.status(500).json({ error: error.message || 'Erreur serveur' })
  }
}
