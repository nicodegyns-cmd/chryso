import emailService from '../../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { users } = req.body

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No users to send invitations to' })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const results = []

    for (const user of users) {
      try {
        const signupUrl = `${baseUrl}/signup?token=${encodeURIComponent(user.invitation_token)}`

        const emailContent = `
Bienvenue,

Vous avez été invité à rejoindre notre plateforme. Cliquez sur le lien ci-dessous pour compléter votre profil:

${signupUrl}

Ce lien est valide pendant 7 jours.

Cordialement,
L'équipe d'administration
        `

        await emailService.send({
          to: user.email,
          subject: 'Invitation à compléter votre profil',
          text: emailContent,
          html: `<p>Bienvenue,</p>
<p>Vous avez été invité à rejoindre notre plateforme. <a href="${signupUrl}">Cliquez ici pour compléter votre profil</a></p>
<p>Ce lien est valide pendant 7 jours.</p>
<p>Cordialement,<br>L'équipe d'administration</p>`
        })

        results.push({ email: user.email, success: true })
      } catch (e) {
        console.error(`Failed to send email to ${user.email}:`, e)
        results.push({ email: user.email, success: false, error: e.message })
      }
    }

    const successful = results.filter(r => r.success).length
    res.status(200).json({
      summary: {
        total: results.length,
        sent: successful,
        failed: results.length - successful
      },
      results
    })
  } catch (error) {
    console.error('Send invitations error:', error)
    return res.status(500).json({ error: 'Failed to send invitations' })
  }
}
