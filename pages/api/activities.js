import { getPool } from '../../services/db'

export default async function handler(req, res){
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).end('Method Not Allowed')
    }

    const { email } = req.query
    
    if (!email) return res.status(401).json({ error: 'Email required' })
    if (!process.env.EBRIGADE_TOKEN) return res.status(500).json({ error: 'EBRIGADE_TOKEN not set' })
    if (!process.env.EBRIGADE_URL) return res.status(500).json({ error: 'EBRIGADE_URL not set' })

    const pool = getPool()
    
    // Load mappings from database
    let mappings = []
    try {
      const mappingsResult = await pool.query(`
        SELECT ebrigade_analytic_name, local_analytic_id, a.code, a.name
        FROM ebrigade_analytics_mapping eam
        LEFT JOIN analytics a ON eam.local_analytic_id = a.id
      `)
      mappings = mappingsResult.rows || []
      console.log('[activities] Loaded mappings:', mappings.length)
    } catch (mappingError) {
      console.warn('[activities] Could not load mappings:', mappingError.message)
      // Continue without mappings
    }

    const userResult = await pool.query('SELECT liaison_ebrigade_id FROM users WHERE email = $1', [email])
    const user = userResult.rows?.[0]

    if (!user) return res.status(404).json({ error: 'User not found', email })
    if (!user.liaison_ebrigade_id) return res.status(200).json({ activities: [], debug: 'No liaison_ebrigade_id for user', email, user })

    console.log('[activities] User found:', email, 'liaison_ebrigade_id:', user.liaison_ebrigade_id)

    const baseUrl = process.env.EBRIGADE_URL.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/api/export/participation.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: process.env.EBRIGADE_TOKEN,
        dDebut: '2024-01-01',
        dFin: '2026-12-31'
      })
    })

    if (!response.ok) return res.status(200).json({ activities: [] })

    const data = await response.json()
    const allParticipations = Array.isArray(data) ? data : data.data || data.participations || []
    
    console.log('[activities] Total participations from eBrigade:', allParticipations.length)
    console.log('[activities] Looking for P_ID:', user.liaison_ebrigade_id)
    
    // Show first few P_IDs for debugging
    if (allParticipations.length > 0) {
      console.log('[activities] Sample P_IDs:', allParticipations.slice(0, 5).map(p => p.P_ID))
    }

    const userParticipations = allParticipations.filter(p => p.P_ID?.toString() === user.liaison_ebrigade_id.toString())
    console.log('[activities] Filtering participations:')
    console.log('  - Looking for P_ID:', user.liaison_ebrigade_id, '(type:', typeof user.liaison_ebrigade_id, ')')
    console.log('  - Available P_IDs:', allParticipations.slice(0, 10).map(p => ({ P_ID: p.P_ID, type: typeof p.P_ID })))
    console.log('  - Matches found:', userParticipations.length)
    const unfilled = userParticipations.filter(p => !p.hours_actual && !p.remuneration_infi && !p.remuneration_med)

    const activities = unfilled.map(p => {
      // Extract prefix from eBrigade analytic name (before ' - ' or ' | ')
      const extractPrefix = (name) => {
        const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
        return match ? match[1].trim() : name
      }
      
      const analyticsPrefix = extractPrefix(p.E_LIBELLE)
      // Look up mapping for this eBrigade analytic prefix
      const mapping = mappings.find(m => m.ebrigade_analytic_name === analyticsPrefix)
      
      return {
        id: `${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`,
        date: p.EH_DATE_DEBUT,
        startTime: p.EH_DEBUT,
        endTime: p.EH_FIN,
        duration: p.EP_DUREE,
        analytic_code: mapping?.code || p.E_CODE,
        analytic_name: mapping?.name || p.E_LIBELLE,
        analytic_id: mapping?.local_analytic_id || null,
        activity: p.E_LIBELLE,
        pay_type: p.TE_LIBELLE || 'Garde',
        status: 'À saisir',
        isActivity: true,
        ebrigade_analytic_name: p.E_LIBELLE  // Keep original eBrigade name for reference
      }
    })

    return res.status(200).json({ activities })
  } catch (err) {
    console.error('[activities]', err)
    return res.status(200).json({ activities: [], error: err.message })
  }
}
