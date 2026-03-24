// Get count of users from eBrigade who are not yet linked in our system
const { query } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const ebrigadeUrl = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const ebrigadeToken = process.env.EBRIGADE_TOKEN

    if (!ebrigadeToken) {
      return res.status(500).json({ error: 'EBRIGADE_TOKEN not configured' })
    }

    // Step 1: Fetch all users from eBrigade
    const searchUrl = `${ebrigadeUrl.replace(/\/$/, '')}/api/export/search.php`
    const searchBody = { token: ebrigadeToken }

    const ebrigadeResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })

    if (!ebrigadeResponse.ok) {
      console.error('eBrigade fetch failed:', ebrigadeResponse.status)
      return res.status(502).json({ error: 'Failed to fetch eBrigade data' })
    }

    const ebrigadeData = await ebrigadeResponse.json()
    const ebrigadeUsers = Array.isArray(ebrigadeData) ? ebrigadeData : (ebrigadeData.remote ? ebrigadeData.remote : [])

    // Step 2: Filter by eligible grades (INFI, MED, Pharmacien, etc.)
    const eligibleGrades = ['INFI', 'MED', 'Pharmacien', 'Infirmier', 'Médecin']
    const filtered = ebrigadeUsers.filter(user => {
      const grade = (user.grade || user.fonction || user.role_label || '').toUpperCase()
      return eligibleGrades.some(g => grade.includes(g))
    })

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

    res.status(200).json({
      pendingCount: unlinkedCount,
      totalEbrigadeUsers: filtered.length,
      message: unlinkedCount === 0 
        ? 'Tous les profils eBrigade sont liés'
        : `${unlinkedCount} profil${unlinkedCount > 1 ? 's' : ''} eBrigade à synchroniser`,
      unlinkedUsers: unlinkedUsers.slice(0, 10) // Return first 10 for reference
    })
  } catch (error) {
    console.error('Error getting pending count:', error)
    res.status(500).json({ error: 'Failed to get pending count', details: error.message })
  }
}
