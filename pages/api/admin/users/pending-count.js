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

    // Step 2: Filter by eligible grades (INFI, MED, Pharmacien, etc.)
    const eligibleGrades = ['INFI', 'MED', 'Pharmacien', 'Infirmier', 'Médecin']
    const filtered = ebrigadeUsers.filter(user => {
      const grade = (user.grade || user.fonction || user.role_label || '').toUpperCase()
      return eligibleGrades.some(g => grade.includes(g))
    })

    console.log('[pending-count] Eligible users after grade filter:', filtered.length)

    // Step 3: For each eBrigade user, check if they're already linked in our system
    let unlinkedCount = 0
    const unlinkedUsers = []

    for (const ebUser of filtered) {
      try {
        const ebrigadeId = String(ebUser.id || ebUser.ebrigade_id || ebUser.EBR_ID || '')
        
        if (!ebrigadeId) continue

        // Check if user already linked in our system
        const existing = await query(
          'SELECT id FROM users WHERE liaison_ebrigade_id = $1 OR ebrigade_id = $1',
          [ebrigadeId]
        )

        if (existing.rows.length === 0) {
          // Not linked yet - eligible for sync
          unlinkedCount++
          unlinkedUsers.push({
            ebrigadeId,
            firstName: ebUser.firstname || ebUser.first_name || '',
            lastName: ebUser.lastname || ebUser.last_name || '',
            email: ebUser.email || ''
          })
        }
      } catch (e) {
        console.error('Error checking user:', e.message)
      }
    }

    console.log('[pending-count] Unlinked users eligible for sync:', unlinkedCount)

    res.status(200).json({
      pendingCount: unlinkedCount,
      totalEbrigadeUsers: filtered.length,
      message: unlinkedCount === 0 
        ? 'Tous les profils eBrigade sont liés'
        : `${unlinkedCount} profil${unlinkedCount > 1 ? 's' : ''} eBrigade à synchroniser`,
      unlinkedUsers: unlinkedUsers.slice(0, 10) // Return first 10 for reference
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
