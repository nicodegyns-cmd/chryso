// Get count of users from eBrigade who are not yet linked in our system
const { query } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const ebrigadeUrl = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const ebrigadeToken = process.env.EBRIGADE_TOKEN

    console.log('[pending-count] EBRIGADE_URL:', ebrigadeUrl)
    console.log('[pending-count] EBRIGADE_TOKEN:', ebrigadeToken ? 'SET' : 'NOT SET')

    if (!ebrigadeToken) {
      console.warn('[pending-count] EBRIGADE_TOKEN not configured')
      return res.status(500).json({ 
        error: 'EBRIGADE_TOKEN not configured',
        pendingCount: 0,
        message: 'Configuration eBrigade manquante'
      })
    }

    // Step 1: Fetch all users from eBrigade
    const searchUrl = `${ebrigadeUrl.replace(/\/$/, '')}/api/export/search.php`
    // Send wildcard search with qstrict=0 to get all users
    const searchBody = { 
      token: ebrigadeToken,
      lastname: '%',  // Wildcard to match all
      qstrict: '0'    // Non-strict matching
    }

    console.log('[pending-count] Querying eBrigade at:', searchUrl)
    console.log('[pending-count] Search body:', JSON.stringify(searchBody))

    const ebrigadeResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })

    console.log('[pending-count] eBrigade response status:', ebrigadeResponse.status)

    if (!ebrigadeResponse.ok) {
      const errorText = await ebrigadeResponse.text()
      console.error('[pending-count] eBrigade fetch failed:', ebrigadeResponse.status, errorText.substring(0, 200))
      return res.status(502).json({ 
        error: 'Failed to fetch eBrigade data',
        statusCode: ebrigadeResponse.status,
        responsePreview: errorText.substring(0, 200),
        pendingCount: 0,
        message: `eBrigade API error ${ebrigadeResponse.status}`
      })
    }

    const ebrigadeData = await ebrigadeResponse.json()
    const ebrigadeUsers = Array.isArray(ebrigadeData) ? ebrigadeData : (ebrigadeData.remote ? ebrigadeData.remote : [])

    console.log('[pending-count] Total eBrigade users:', ebrigadeUsers.length)

    // Step 2: Batch check - get all linked eBrigade IDs in ONE query instead of N queries
    const ebrigadeIds = ebrigadeUsers
      .map(u => String(u.id || u.ebrigade_id || u.EBR_ID || ''))
      .filter(id => id.length > 0)

    let linkedIds = new Set()
    if (ebrigadeIds.length > 0) {
      // Single query: get all users with ANY of these eBrigade IDs
      const placeholders = ebrigadeIds.map((_, i) => `$${i + 1}`).join(',')
      const linkedResult = await query(
        `SELECT liaison_ebrigade_id, ebrigade_id FROM users WHERE liaison_ebrigade_id = ANY($1) OR ebrigade_id = ANY($1)`,
        [ebrigadeIds]
      )
      linkedIds = new Set([
        ...linkedResult.rows.map(r => r.liaison_ebrigade_id),
        ...linkedResult.rows.map(r => r.ebrigade_id)
      ])
    }

    console.log('[pending-count] Linked IDs in system:', linkedIds.size)

    // Step 3: Filter unlinked users
    const unlinkedUsers = ebrigadeUsers
      .map(ebUser => {
        const ebrigadeId = String(ebUser.id || ebUser.ebrigade_id || ebUser.EBR_ID || '')
        const email = ebUser.email || ''
        
        return {
          ebrigadeId,
          firstName: ebUser.firstname || ebUser.first_name || '',
          lastName: ebUser.lastname || ebUser.last_name || '',
          email,
          isLinked: linkedIds.has(ebrigadeId)
        }
      })
      .filter(u => u.ebrigadeId && u.email && !u.isLinked)

    const unlinkedCount = unlinkedUsers.length
    console.log('[pending-count] Unlinked users eligible for sync:', unlinkedCount)

    res.status(200).json({
      pendingCount: unlinkedCount,
      totalEbrigadeUsers: ebrigadeUsers.length,
      message: unlinkedCount === 0 
        ? 'Tous les profils eBrigade sont liés'
        : `${unlinkedCount} profil${unlinkedCount > 1 ? 's' : ''} eBrigade à synchroniser`,
      emails: unlinkedUsers.map(u => u.email).filter(e => e), // Return just emails
      unlinkedUsers: unlinkedUsers.map(u => ({
        ebrigadeId: u.ebrigadeId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email
      })) // Return full user data for debugging (without isLinked flag)
    })
  } catch (error) {
    console.error('[pending-count] Error:', error)
    res.status(500).json({ 
      error: 'Failed to get pending count', 
      details: error.message,
      pendingCount: 0
    })
  }
}
