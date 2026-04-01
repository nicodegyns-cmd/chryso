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
      if (p.E_LIBELLE && p.E_CODE) {
        // Use prefix as unique key (e.g., "APS", "Permanence INFI", "Garde NUIT")
        const prefix = extractPrefix(p.E_LIBELLE)
        if (!analyticsMap.has(prefix)) {
          analyticsMap.set(prefix, {
            ebrigade_analytic_code: p.E_CODE,
            ebrigade_analytic_name: prefix,
            activity_type: p.TE_LIBELLE || '',
            local_analytic_id: null,
            code: null,
            name: null
          })
        }
      }
    }

    // Also add any codes that exist in activity_ebrigade_mappings but not in eBrigade API response
    // This ensures previously mapped codes are shown in checkboxes
    const { getPool: getPoolForMappings } = await import('../../../../services/db')
    const poolForMappings = getPoolForMappings()
    try {
      const existingMappingsResult = await poolForMappings.query(`
        SELECT DISTINCT ebrigade_analytic_name 
        FROM activity_ebrigade_mappings 
        ORDER BY ebrigade_analytic_name
      `)
      for (const row of existingMappingsResult.rows) {
        const analytName = row.ebrigade_analytic_name
        if (!analyticsMap.has(analytName)) {
          // Add code that exists in DB but not in recent eBrigade API response
          // Extract the 4-digit code if it exists in the name
          const codeMatch = analytName.match(/(\d{4})/)
          const code = codeMatch ? codeMatch[1] : analytName
          analyticsMap.set(analytName, {
            ebrigade_analytic_code: code,
            ebrigade_analytic_name: analytName,
            activity_type: '',
            local_analytic_id: null,
            code: null,
            name: null
          })
        }
      }
    } catch (e) {
      console.warn('[ebrigade-analytics/available] Failed to load existing mappings:', e.message)
      // Continue without this data
    }

    // Get the pool to check for existing mappings and enrich with local activity info
    const { getPool } = await import('../../../../services/db')
    const pool = getPool()
    
    try {
      const enrichResult = await pool.query(`
        SELECT 
          aam.ebrigade_analytic_name,
          aam.activity_id,
          a.code,
          a.name
        FROM activity_ebrigade_mappings aam
        LEFT JOIN activities a ON aam.activity_id = a.id
      `)

      // Enrich analytics with mapping info (which local activity they're linked to)
      for (const mapping of enrichResult.rows) {
        const entries = Array.from(analyticsMap.values())
        const entry = entries.find(e => e.ebrigade_analytic_name === mapping.ebrigade_analytic_name)
        if (entry) {
          entry.local_analytic_id = mapping.activity_id
          entry.code = mapping.code
          entry.name = mapping.name
        }
      }
    } catch (e) {
      console.warn('[ebrigade-analytics/available] Failed to enrich with local activity data:', e.message)
      // Continue without this enrichment
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
