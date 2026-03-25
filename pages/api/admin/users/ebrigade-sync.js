// Phase 7: Sync users from eBrigade - detect non-linked accounts and send invitations
const { query } = require('../../../../services/db')
const crypto = require('crypto')
const emailService = require('../../../../services/emailService')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Step 1: Query eBrigade for eligible grades (INFI, MED, Pharmacien)
    const ebrigadeUrl = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const ebrigadeToken = process.env.EBRIGADE_TOKEN
    
    console.log('DEBUG: ebrigadeUrl =', ebrigadeUrl)
    console.log('DEBUG: ebrigadeToken =', ebrigadeToken ? 'SET' : 'NOT SET')
    
    if (!ebrigadeToken) {
      console.error('ERROR: EBRIGADE_TOKEN not configured')
      return res.status(500).json({ error: 'EBRIGADE_TOKEN not configured' })
    }

    // Fetch users from eBrigade
    const searchUrl = `${ebrigadeUrl.replace(/\/$/, '')}/api/export/search.php`
    const searchBody = {
      token: ebrigadeToken,
      lastname: '%',  // Wildcard to get all users
      qstrict: '0'    // Non-strict matching
    }

    console.log('DEBUG: searchUrl =', searchUrl)
    console.log('DEBUG: searchBody =', JSON.stringify(searchBody, null, 2))

    const ebrigadeResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })

    console.log('DEBUG: ebrigadeResponse.status =', ebrigadeResponse.status)
    console.log('DEBUG: ebrigadeResponse.ok =', ebrigadeResponse.ok)

    if (!ebrigadeResponse.ok) {
      const errorText = await ebrigadeResponse.text()
      console.error('eBrigade search failed:', ebrigadeResponse.status, errorText)
      return res.status(502).json({ error: 'eBrigade search failed', statusCode: ebrigadeResponse.status, details: errorText.substring(0, 200) })
    }

    const ebrigadeData = await ebrigadeResponse.json()
    console.log('DEBUG: ebrigadeData type =', typeof ebrigadeData, 'isArray =', Array.isArray(ebrigadeData))
    console.log('DEBUG: ebrigadeData length =', Array.isArray(ebrigadeData) ? ebrigadeData.length : 'N/A')
    const ebrigadeUsers = Array.isArray(ebrigadeData) ? ebrigadeData : (ebrigadeData.remote ? ebrigadeData.remote : [])

    // Step 2: Batch validation - collect all data first, then do single queries
    const batchId = crypto.randomBytes(16).toString('hex')
    const toCreate = []
    const alreadyLinked = []
    const errors = []
    const skippedUsers = []

    // Extract data first AND track those with missing data
    const usersToProcess = []
    for (const ebUser of ebrigadeUsers) {
      const data = {
        original: ebUser,
        ebrigadeId: String(ebUser.id || ebUser.ebrigade_id || ebUser.EBR_ID || ''),
        email: (ebUser.email || '').toLowerCase().trim(),
        firstName: (ebUser.firstname || ebUser.first_name || '').trim(),
        lastName: (ebUser.lastname || ebUser.last_name || '').trim(),
        grade: (ebUser.grade || ebUser.fonction || ebUser.role_label || 'UNKNOWN').toUpperCase()
      }

      if (!data.ebrigadeId || !data.email || !data.firstName || !data.lastName) {
        skippedUsers.push({
          id: data.ebrigadeId || 'UNKNOWN',
          grade: data.grade,
          reason: !data.email ? 'missing_email' : 'missing_name'
        })
      } else {
        usersToProcess.push(data)
      }
    }

    // Batch query 1: Find all ALREADY LINKED users (by ebrigadeId or email)
    const linkedByEbrigadeId = new Set()
    const linkedByEmail = new Map()
    
    if (usersToProcess.length > 0) {
      const ebrigadeIds = usersToProcess.map(u => u.ebrigadeId)
      const emails = usersToProcess.map(u => u.email)

      const linkedQuery = await query(
        `SELECT id, email, liaison_ebrigade_id FROM users 
         WHERE liaison_ebrigade_id = ANY($1) OR email = ANY($2)`,
        [ebrigadeIds, emails]
      )

      linkedQuery.rows.forEach(row => {
        if (row.liaison_ebrigade_id) linkedByEbrigadeId.add(row.liaison_ebrigade_id)
        linkedByEmail.set(row.email, row.id)
      })
    }

    // Batch query 2: Find emails that exist but aren't linked to eBrigade
    const emailsNotLinked = new Set()
    const unlinkedEmails = usersToProcess
      .filter(u => !linkedByEbrigadeId.has(u.ebrigadeId) && linkedByEmail.has(u.email))
      .map(u => u.email)

    if (unlinkedEmails.length > 0) {
      const unlinkedQuery = await query(
        `SELECT id, email FROM users WHERE email = ANY($1) AND liaison_ebrigade_id IS NULL`,
        [unlinkedEmails]
      )
      unlinkedQuery.rows.forEach(row => emailsNotLinked.add(row.email))
    }

    // Now process all users efficiently
    for (const userData of usersToProcess) {
      const { original, ebrigadeId, email, firstName, lastName } = userData

      // Check 1: Already linked by eBrigadeId
      if (linkedByEbrigadeId.has(ebrigadeId)) {
        alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'already_linked' })
        continue
      }

      // Check 2: Email exists but not linked (will update)
      if (emailsNotLinked.has(email)) {
        await query(
          'UPDATE users SET liaison_ebrigade_id = $1 WHERE email = $2',
          [ebrigadeId, email]
        )
        alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'linked_existing' })
        continue
      }

      // Check 3: Email already exists (via another eBrigade ID)
      if (linkedByEmail.has(email)) {
        alreadyLinked.push({ email, firstName, lastName, ebrigadeId, status: 'email_conflict' })
        continue
      }

      // Step 3: Create new user with pending_signup status
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
    }

    // Step 4: Send invitation emails for newly created users
    const emailResults = []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    for (const user of toCreate) {
      try {
        const signupUrl = `${baseUrl}/signup?token=${encodeURIComponent(user.invitationToken)}`
        const emailContent = `
Bienvenue,

Vous avez été détecté dans la base eBrigade et une invitation à rejoindre notre plateforme vous a été envoyée.

Cliquez sur le lien ci-dessous pour compléter votre profil:

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
        totalEbrigadeUsers: ebrigadeUsers.length,
        processedUsers: usersToProcess.length,
        created: toCreate.length,
        alreadyLinked: alreadyLinked.length,
        emailsSent: sentCount,
        emailsFailed: toCreate.length - sentCount,
        skippedDueToMissingData: skippedUsers.length,
        errors: errors.length
      },
      created: toCreate,
      alreadyLinked,
      skippedUsers: skippedUsers.slice(0, 10), // Show first 10 skipped with reason
      emailResults,
      errors: errors.slice(0, 10) // Return first 10 errors
    })
  } catch (error) {
    console.error('eBrigade sync error:', error)
    return res.status(500).json({ error: 'Failed to sync eBrigade users', details: error.message })
  }
}
