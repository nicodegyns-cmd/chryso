// Sync only selected eBrigade users - for testing
const { query } = require('../../../../services/db')
const crypto = require('crypto')
const emailService = require('../../../../services/emailService')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { selectedIds } = req.body // Array of eBrigade IDs to sync

  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return res.status(400).json({ error: 'No users selected' })
  }

  try {
    const ebrigadeUrl = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const ebrigadeToken = process.env.EBRIGADE_TOKEN

    if (!ebrigadeToken) {
      return res.status(500).json({ error: 'EBRIGADE_TOKEN not configured' })
    }

    // Fetch all users from eBrigade
    const searchUrl = `${ebrigadeUrl.replace(/\/$/, '')}/api/export/search.php`
    const searchBody = {
      token: ebrigadeToken,
      lastname: '%',
      qstrict: '0'
    }

    const ebrigadeResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })

    if (!ebrigadeResponse.ok) {
      const errorText = await ebrigadeResponse.text()
      return res.status(502).json({ 
        error: 'Failed to fetch eBrigade data',
        statusCode: ebrigadeResponse.status
      })
    }

    const ebrigadeData = await ebrigadeResponse.json()
    const ebrigadeUsers = Array.isArray(ebrigadeData) ? ebrigadeData : (ebrigadeData.remote ? ebrigadeData.remote : [])

    // Filter to only selected users
    const selectedSet = new Set(selectedIds)
    const usersToProcess = ebrigadeUsers
      .filter(u => {
        const ebrigadeId = String(u.id || u.ebrigade_id || u.EBR_ID || '')
        return selectedSet.has(ebrigadeId)
      })
      .map(ebUser => ({
        original: ebUser,
        ebrigadeId: String(ebUser.id || ebUser.ebrigade_id || ebUser.EBR_ID || ''),
        email: (ebUser.email || '').toLowerCase().trim(),
        firstName: (ebUser.firstname || ebUser.first_name || '').trim(),
        lastName: (ebUser.lastname || ebUser.last_name || '').trim()
      }))
      .filter(u => u.ebrigadeId && u.email && u.firstName && u.lastName)

    if (usersToProcess.length === 0) {
      return res.status(400).json({ error: 'No valid users found with selected IDs' })
    }

    // Batch check linked users
    const batchId = crypto.randomBytes(16).toString('hex')

    const ebrigadeIds = usersToProcess.map(u => u.ebrigadeId)
    const emails = usersToProcess.map(u => u.email)

    const linkedQuery = await query(
      `SELECT id, email, liaison_ebrigade_id FROM users 
       WHERE liaison_ebrigade_id = ANY($1) OR email = ANY($2)`,
      [ebrigadeIds, emails]
    )

    const linkedByEbrigadeId = new Set()
    const linkedByEmail = new Map()

    linkedQuery.rows.forEach(row => {
      if (row.liaison_ebrigade_id) linkedByEbrigadeId.add(row.liaison_ebrigade_id)
      linkedByEmail.set(row.email, row.id)
    })

    // Process each user
    const toCreate = []
    const invitationsToSend = [] // Track all invitations to send
    const alreadyLinked = []

    for (const userData of usersToProcess) {
      const { ebrigadeId, email, firstName, lastName } = userData

      // Check if already linked by eBrigade ID
      if (linkedByEbrigadeId.has(ebrigadeId)) {
        // Still get the user to send them an invitation
        const existingUserQuery = await query(
          'SELECT id FROM users WHERE liaison_ebrigade_id = $1',
          [ebrigadeId]
        )
        if (existingUserQuery.rows.length > 0) {
          // Generate new invitation token (for testing purposes)
          const invitationToken = crypto.randomBytes(32).toString('hex')
          const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          
          // Update user with new invitation
          await query(
            `UPDATE users SET invitation_token = $1, invitation_sent_at = $2, invitation_expires_at = $3, onboarding_status = $5
             WHERE liaison_ebrigade_id = $4`,
            [invitationToken, new Date(), invitationExpiresAt, ebrigadeId, 'pending_signup']
          )
          
          invitationsToSend.push({
            email, firstName, lastName, ebrigadeId, invitationToken, isExisting: true
          })
          alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'already_linked' })
          continue
        }
      }

      // Check if email exists unlinked
      const unlinkedQuery = await query(
        'SELECT id FROM users WHERE email = $1 AND liaison_ebrigade_id IS NULL',
        [email]
      )

      if (unlinkedQuery.rows.length > 0) {
        await query(
          'UPDATE users SET liaison_ebrigade_id = $1 WHERE email = $2',
          [ebrigadeId, email]
        )
        
        // Still send invitation
        const invitationToken = crypto.randomBytes(32).toString('hex')
        const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        
        await query(
          `UPDATE users SET invitation_token = $1, invitation_sent_at = $2, invitation_expires_at = $3, onboarding_status = $5
           WHERE email = $4`,
          [invitationToken, new Date(), invitationExpiresAt, email, 'pending_signup']
        )
        
        invitationsToSend.push({
          email, firstName, lastName, ebrigadeId, invitationToken, isExisting: true
        })
        alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'linked_existing' })
        continue
      }

      // Check if email already taken by another eBrigade ID
      if (linkedByEmail.has(email)) {
        // Still send invitation to existing account (for testing)
        const existingId = linkedByEmail.get(email)
        const invitationToken = crypto.randomBytes(32).toString('hex')
        const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        
        await query(
          `UPDATE users SET invitation_token = $1, invitation_sent_at = $2, invitation_expires_at = $3, onboarding_status = $5
           WHERE id = $4`,
          [invitationToken, new Date(), invitationExpiresAt, existingId, 'pending_signup']
        )
        
        invitationsToSend.push({
          email, firstName, lastName, ebrigadeId, invitationToken, isExisting: true
        })
        alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'email_conflict' })
        continue
      }

      // Create new user with pending_signup status
      const invitationToken = crypto.randomBytes(32).toString('hex')
      const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const result = await query(
        `INSERT INTO users (email, first_name, last_name, liaison_ebrigade_id, onboarding_status, 
         invitation_token, invitation_sent_at, invitation_expires_at, import_batch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, email, first_name, last_name`,
        [
          email,
          firstName,
          lastName,
          ebrigadeId,
          'pending_signup',
          invitationToken,
          new Date(),
          invitationExpiresAt,
          batchId,
          1
        ]
      )

      const newUser = result.rows[0]
      toCreate.push({
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        ebrigadeId,
        invitationToken
      })
      
      invitationsToSend.push({
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        ebrigadeId,
        invitationToken,
        isExisting: false
      })
    }

    // Send invitation emails
    const emailResults = []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    for (const user of invitationsToSend) {
      try {
        const signupUrl = `${baseUrl}/signup?token=${encodeURIComponent(user.invitationToken)}`
        const emailContent = `
Bienvenue,

Vous avez été détecté dans la base eBrigade et une invitation à rejoindre notre plateforme vous a été envoyée.

Cliquez sur le lien ci-dessous pour compléter votre profil:

${signupUrl}

Ce lien est valide pendant 7 jours.

Cordialement,
L'équipe d'administration`

        await emailService.send({
          to: user.email,
          subject: 'Invitation à compléter votre profil',
          text: emailContent,
          html: `<p>Bienvenue,</p>
<p>Vous avez été détecté dans la base eBrigade et une invitation à rejoindre notre plateforme vous a été envoyée.</p>
<p><a href="${signupUrl}">Cliquez ici pour compléter votre profil</a></p>
<p>Ce lien est valide pendant 7 jours.</p>
<p>Cordialement,<br>L'équipe d'administration</p>`
        })

        emailResults.push({ email: user.email, success: true })
      } catch (e) {
        console.error(`Failed to send email to ${user.email}:`, e)
        emailResults.push({ email: user.email, success: false, error: e.message })
      }
    }

    const sentCount = emailResults.filter(r => r.success).length

    res.status(200).json({
      batchId,
      summary: {
        totalSelected: selectedIds.length,
        processedUsers: usersToProcess.length,
        created: toCreate.length,
        alreadyLinked: alreadyLinked.length,
        emailsSent: sentCount,
        emailsFailed: invitationsToSend.length - sentCount
      },
      created: toCreate,
      alreadyLinked,
      emailResults
    })
  } catch (error) {
    console.error('eBrigade sync-selected error:', error)
    return res.status(500).json({ error: 'Failed to sync selected users', details: error.message })
  }
}
