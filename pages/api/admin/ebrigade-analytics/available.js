export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Check if eBrigade is configured
    if (!process.env.EBRIGADE_TOKEN || !process.env.EBRIGADE_URL) {
      return res.status(500).json({ error: 'eBrigade not configured' })
    }

    // Call eBrigade API to get all participations
    const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const participationUrl = `${base.replace(/\/$/, '')}/api/export/participation.php`

    const now = new Date()
    const formatDate = (d) => d.toISOString().split('T')[0]
    const dDebut = formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
    const dFin = formatDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)) // 90 days from now

    const payload = {
      token: process.env.EBRIGADE_TOKEN,
      dDebut,
      dFin
    }

    console.log('[ebrigade-analytics/available] Calling eBrigade API')

    const response = await fetch(participationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const text = await response.text()
    let allPrestations = []

    try {
      const data = JSON.parse(text)
      allPrestations = Array.isArray(data) ? data : data.data || data.participations || []
    } catch (e) {
      console.error('[ebrigade-analytics/available] Failed to parse eBrigade response:', e.message)
      return res.status(502).json({ error: 'Failed to parse eBrigade response' })
    }

    // Extract unique analytics from prestations (deduplicate by prefix before ' - ' or ' | ')
    const extractPrefix = (name) => {
      // Extract text before ' - ' or ' | '
      const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
      return match ? match[1].trim() : name
    }

    const analyticsMap = new Map()
    
    for (const p of allPrestations) {
      if (p.E_CODE) {
        // Use E_CODE as unique key directly (numeric codes like 9336, 9610, etc.)
        const code = String(p.E_CODE)
        if (!analyticsMap.has(code)) {
          analyticsMap.set(code, {
            ebrigade_code: code,
            ebrigade_name: p.E_LIBELLE || `Code ${code}`, // fallback to code if no name
            activity_type: p.TE_LIBELLE || '',
            local_activity_id: null,
            local_activity: null
          })
        }
      }
    }

    // Also add any codes that exist in activity_ebrigade_mappings but not in recent eBrigade API response
    // This ensures codes already linked are still shown in checkboxes
    const { getPool: getPoolForMappings } = await import('../../../../services/db')
    const poolForMappings = getPoolForMappings()
    try {
      const existingMappingsResult = await poolForMappings.query(`
        SELECT DISTINCT ebrigade_analytic_name
        FROM activity_ebrigade_mappings
        ORDER BY ebrigade_analytic_name
      `)
      for (const row of existingMappingsResult.rows) {
        const code = row.ebrigade_analytic_name
        // Skip if already in map
        if (!analyticsMap.has(code)) {
          analyticsMap.set(code, {
            ebrigade_code: code,
            ebrigade_name: `Code ${code}`,
            activity_type: '',
            local_activity_id: null,
            local_activity: null
          })
        }
      }
    } catch (e) {
      console.warn('[ebrigade-analytics/available] Failed to load existing mappings:', e.message)
    }

    // Get the pool to check for existing mappings and enrich with local activity info
    const { getPool } = await import('../../../../services/db')
    const pool = getPool()
    
    try {
      const enrichResult = await pool.query(`
        SELECT 
          aam.ebrigade_analytic_name as code,
          aam.activity_id,
          a.name as activity_name
        FROM activity_ebrigade_mappings aam
        LEFT JOIN activities a ON aam.activity_id = a.id
      `)

      // Enrich analytics with mapping info (which local activity they're linked to)
      for (const mapping of enrichResult.rows) {
        const code = mapping.code
        const entry = analyticsMap.get(code)
        if (entry) {
          entry.local_activity_id = mapping.activity_id
          entry.local_activity = mapping.activity_name
        }
      }
    } catch (e) {
      console.warn('[ebrigade-analytics/available] Failed to enrich with local activity data:', e.message)
    }

    const availableAnalytics = Array.from(analyticsMap.values())
    
    return res.status(200).json({ 
      analytics: availableAnalytics,
      count: availableAnalytics.length
    })
  } catch (error) {
    console.error('[ebrigade-analytics/available]', error.message)
    res.status(500).json({ error: error.message })
  }
}
