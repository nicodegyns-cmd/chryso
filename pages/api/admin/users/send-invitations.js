const emailService = require('../../../../services/emailService')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { users } = req.body

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No users to send invitations to' })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const results = []

    // Filter out invitation-excluded users (by profile flag OR email table)
    const { query: dbQuery } = require('../../../../services/db')
    let allowedUsers = users
    try {
      const emails = users.map(u => u.email)
      const [excQ, excEmailQ] = await Promise.all([
        dbQuery(`SELECT email FROM users WHERE invitation_excluded = TRUE AND email = ANY($1)`, [emails]),
        dbQuery(`SELECT email FROM excluded_invitation_emails WHERE LOWER(email) = ANY($1)`, [emails.map(e => e.toLowerCase())])
      ])
      const excludedEmails = new Set([
        ...(excQ.rows || []).map(r => r.email.toLowerCase()),
        ...(excEmailQ.rows || []).map(r => r.email.toLowerCase())
      ])
      allowedUsers = users.filter(u => !excludedEmails.has((u.email || '').toLowerCase()))
    } catch (e) { /* fail open */ }

    for (const user of allowedUsers) {
      try {
        const signupUrl = `${baseUrl}/signup?token=${encodeURIComponent(user.invitation_token)}`
        const result = await emailService.sendInvitationEmail(user.email, signupUrl, user.first_name || null)
        results.push({ email: user.email, success: result.sent, error: result.error })
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
