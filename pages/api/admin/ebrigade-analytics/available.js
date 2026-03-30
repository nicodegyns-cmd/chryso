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

    // Extract unique analytics from prestations (deduplicate by name, not code)
    const analyticsMap = new Map()
    
    for (const p of allPrestations) {
      if (p.E_LIBELLE && p.E_CODE) {
        // Use E_LIBELLE (name) as unique key to avoid duplicates with same name but different codes
        if (!analyticsMap.has(p.E_LIBELLE)) {
          analyticsMap.set(p.E_LIBELLE, {
            ebrigade_analytic_code: p.E_CODE,
            ebrigade_analytic_name: p.E_LIBELLE,
            activity_type: p.TE_LIBELLE || '',
            local_analytic_id: null,
            code: null,
            name: null
          })
        }
      }
    }

    // Get the pool to check for existing mappings
    const { getPool } = await import('../../../../services/db')
    const pool = getPool()
    
    try {
      const mappingsResult = await pool.query(`
        SELECT 
          ebrigade_analytic_name,
          local_analytic_id,
          a.code,
          a.name
        FROM ebrigade_analytics_mapping eam
        LEFT JOIN analytics a ON eam.local_analytic_id = a.id
      `)

      // Enrich analytics with mapping info
      for (const mapping of mappingsResult.rows) {
        const entries = Array.from(analyticsMap.values())
        const entry = entries.find(e => e.ebrigade_analytic_name === mapping.ebrigade_analytic_name)
        if (entry) {
          entry.local_analytic_id = mapping.local_analytic_id
          entry.code = mapping.code
          entry.name = mapping.name
        }
      }
    } catch (e) {
      console.warn('[ebrigade-analytics/available] Failed to fetch mappings:', e.message)
      // Continue without mappings if database fails
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
