const { query } = require('../../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    const { liaison_ebrigade_id, role, niss, bce, account } = req.body

    if (!id || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Update user: set liaison_ebrigade_id, role, admin fields, mark as active
    // DO NOT change password - user set their own password in onboarding step 3
    const result = await query(
      `UPDATE users
       SET liaison_ebrigade_id = $1,
           role = $2,
           niss = $3,
           bce = $4,
           account = $5,
           onboarding_status = $6,
           is_active = 1,
           must_complete_profile = false
       WHERE id = $7
       RETURNING id, email, first_name, last_name, role`,
      [liaison_ebrigade_id || null, role, niss || null, bce || null, account || null, 'active', parseInt(id)]
    )

    const rows = result.rows || result[0] || []
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = rows[0]
    const roleLabel = role === 'INFI' ? 'Infirmier' : role === 'MED' ? 'Médecin' : role

    // Send email to user notifying validation
    try {
      const { send } = require('../../../../../services/emailService')
      const appName = process.env.APP_NAME || 'Fenix'
      const appUrl = process.env.APP_URL || 'https://www.sirona-consult.be'
      
      const html = `<p>Bonjour ${user.first_name || ''},</p>
<p>Votre compte a été <strong>validé et activé</strong> par l'administration.</p>
<p>Vous êtes maintenant inscrit en tant que <strong>${roleLabel}</strong> sur la plateforme.</p>
<p>Vous pouvez accéder à votre espace ici : <a href="${appUrl}" style="color: #f97316; font-weight: 600;">Connexion</a></p>
<p>-- ${appName}</p>`
      
      const text = `Bonjour ${user.first_name || ''},\n\nVotre compte a été validé et activé par l'administration!\nVous êtes maintenant inscrit en tant que ${roleLabel}.\n\nAccédez à votre espace : ${appUrl}`

      await send({
        to: user.email,
        subject: `${appName} - Compte activé`,
        html,
        text
      })
    } catch (e) {
      console.warn('Failed to send validation email to user', e)
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Validate user error:', error)
    return res.status(500).json({ error: 'Failed to validate user' })
  }
}
