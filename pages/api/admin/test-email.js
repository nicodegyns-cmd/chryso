import { sendUserCreationEmail } from '../../../services/emailService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, firstName } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' })
  }

  try {
    console.log('[api/admin/test-email] Testing email send to:', email)
    const result = await sendUserCreationEmail(email, password, firstName || 'Test User')
    
    return res.status(200).json({
      success: true,
      emailResult: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[api/admin/test-email] Error:', error)
    return res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
}
