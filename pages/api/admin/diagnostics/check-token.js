// pages/api/admin/diagnostics/check-token.js
// For debugging: Check if an invitation token is valid
// PUBLIC endpoint (no auth required) - for debugging only

const { query } = require('../../../../services/db')

module.exports = async function handler(req, res) {
  try {
    const { token } = req.query

    if (!token) {
      return res.status(400).json({ error: 'Token parameter required' })
    }

    // Find user with this token
    const result = await query(
      `SELECT 
        id,
        email, 
        first_name,
        last_name,
        invitation_token,
        invitation_sent_at,
        invitation_expires_at,
        onboarding_status,
        liaison_ebrigade_id
       FROM users 
       WHERE invitation_token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(200).json({
        found: false,
        message: 'No user found with this token'
      })
    }

    const user = result.rows[0]
    const expiresAt = new Date(user.invitation_expires_at)
    const now = new Date()
    const isExpired = expiresAt < now
    const isValid = !isExpired && user.onboarding_status === 'pending_signup'

    return res.status(200).json({
      found: true,
      isValid,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        ebrigadeId: user.liaison_ebrigade_id,
        onboardingStatus: user.onboarding_status
      },
      token: {
        token: user.invitation_token ? 'EXISTS' : 'NOT SET',
        sentAt: user.invitation_sent_at,
        expiresAt: user.invitation_expires_at,
        isExpired,
        expiresIn: isExpired ? 'expired' : `${Math.floor((expiresAt - now) / 1000 / 60)} minutes`,
        status: isValid ? '✅ VALID' : isExpired ? '❌ EXPIRED' : `❌ INVALID (status: ${user.onboarding_status})`
      }
    })
  } catch (error) {
    console.error('Check token error:', error)
    return res.status(500).json({ error: 'Failed to check token', details: error.message })
  }
}
