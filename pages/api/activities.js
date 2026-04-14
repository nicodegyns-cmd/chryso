import { getPool } from '../../services/db'

export default async function handler(req, res){
  // Prevent caching for this endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  
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
    
    // Load mappings from database (NAME-BASED matching)
    let mappings = []
    try {
      const mappingsResult = await pool.query(`
        SELECT 
          nam.ebrigade_analytic_name_pattern as ebrigade_analytic_name,
          nam.activity_id as local_activity_id,
          a.id,
          a.analytic_id as activity_analytic_id
        FROM activity_ebrigade_name_mappings nam
        LEFT JOIN activities a ON nam.activity_id = a.id
      `)
      mappings = mappingsResult.rows || []
      console.log('[activities] Loaded name-based mappings:', mappings.length, 'patterns:', mappings.map(m => m.ebrigade_analytic_name))
    } catch (mappingError) {
      console.warn('[activities] Could not load mappings:', mappingError.message)
      // Continue without mappings
    }

    const userResult = await pool.query('SELECT id, liaison_ebrigade_id FROM users WHERE email = $1', [email])
    const user = userResult.rows?.[0]

    console.log('[activities] User query result:', userResult.rows)
    
    if (!user) return res.status(404).json({ error: 'User not found', email })
    if (!user.liaison_ebrigade_id) {
      console.log('[activities] User has no liaison_ebrigade_id:', email)
      return res.status(200).json({ activities: [], debug: 'No liaison_ebrigade_id for user', email, user })
    }

    console.log('[activities] User found:', email, 'liaison_ebrigade_id:', user.liaison_ebrigade_id)

    const baseUrl = process.env.EBRIGADE_URL.replace(/\/$/, '')
    console.log('[activities] Calling eBrigade API at:', baseUrl)
    
    const response = await fetch(`${baseUrl}/api/export/participation.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: process.env.EBRIGADE_TOKEN,
        dDebut: '2024-01-01',
        dFin: '2026-12-31'
      })
    })

    console.log('[activities] eBrigade response status:', response.status, response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('[activities] eBrigade error response:', errorText)
      return res.status(200).json({ activities: [], debug: 'eBrigade API error', status: response.status })
    }

    const text = await response.text()
    console.log('[activities] eBrigade response length:', text.length)
    
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('[activities] Failed to parse eBrigade response:', e.message)
      return res.status(200).json({ activities: [], debug: 'Failed to parse eBrigade response' })
    }
    
    const allParticipations = Array.isArray(data) ? data : data.data || data.participations || []
    console.log('[activities] Parsed participations - type:', typeof data, 'is array:', Array.isArray(data), 'length:', allParticipations.length)
    
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
      let mapping = mappings.find(m => m.ebrigade_analytic_name === analyticsPrefix)
      
      // Fallback: if exact match fails, try partial match
      if (!mapping && analyticsPrefix) {
        console.log('[activities] Exact mapping failed for:', analyticsPrefix, 'trying partial match')
        mapping = mappings.find(m => m.ebrigade_analytic_name && m.ebrigade_analytic_name.includes(analyticsPrefix.substring(0, 10)))
      }
      
      // Log for debugging
      if (!mapping) {
        console.warn('[activities] No mapping found for:', analyticsPrefix, 'E_CODE:', p.E_CODE, 'E_LIBELLE:', p.E_LIBELLE)
        console.warn('[activities] Available mappings:', mappings.map(m => m.ebrigade_analytic_name).slice(0, 5))
      }
      
      return {
        id: `ebrig_${user.liaison_ebrigade_id}_${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`,
        date: p.EH_DATE_DEBUT,
        startTime: p.EH_DEBUT,
        endTime: p.EH_FIN,
        duration: p.EP_DUREE,
        analytic_code: p.E_CODE,  // Always eBrigade code
        analytic_name: p.E_LIBELLE,  // Always display full eBrigade name to user
        analytic_id: mapping?.activity_analytic_id || null,  // ID from analytics table (3,4,5,6,7) - NOT activity id
        activity: p.E_LIBELLE,
        pay_type: p.TE_LIBELLE || 'Garde',
        status: 'À saisir',
        isActivity: true,
        ebrigade_analytic_name: p.E_LIBELLE,
        ebrigade_activity_name: p.E_LIBELLE,  // IMPORTANT: composant PrestationsTable cherche ce champ!
        ebrigade_activity_code: p.E_CODE,  // Send code too for fallback
        _mapping: mapping,  // Keep mapping for DB filtering and tariff lookup
        _mapped_activity_id: mapping?.local_activity_id  // Local activity id for tariff lookup
      }
    })

    // Filter out activities that already have a prestation in the database
    const activitiesWithoutPrestations = []
    for (const activity of activities) {
      try {
        // Check if a prestation exists for this activity
        let existingPrestationResult = null
        
        if (activity.analytic_code) {
          // Strategy 1: Match by E_CODE (most specific — avoids cross-activity collisions on same date).
          // activity.analytic_code = eBrigade E_CODE; saved as ebrigade_activity_code on prestations.
          existingPrestationResult = await pool.query(
            `SELECT id FROM prestations
             WHERE user_id = $1
             AND date = $2
             AND ebrigade_activity_code = $3
             AND status != 'Envoyé à la facturation'
             LIMIT 1`,
            [user.id, activity.date, activity.analytic_code]
          )
          // Fallback: if no prestation found by E_CODE, check by analytic_id for prestations
          // that were saved before ebrigade_activity_code was stored (no E_CODE on prestation).
          if ((!existingPrestationResult.rows || existingPrestationResult.rows.length === 0) && activity.analytic_id) {
            existingPrestationResult = await pool.query(
              `SELECT id FROM prestations
               WHERE user_id = $1
               AND date = $2
               AND analytic_id = $3
               AND (ebrigade_activity_code IS NULL OR ebrigade_activity_code = '')
               AND status != 'Envoyé à la facturation'
               LIMIT 1`,
              [user.id, activity.date, activity.analytic_id]
            )
          }
        } else if (activity.analytic_id) {
          // Strategy 2: No E_CODE available — match by analytic_id only
          existingPrestationResult = await pool.query(
            `SELECT id FROM prestations
             WHERE user_id = $1
             AND date = $2
             AND analytic_id = $3
             AND status != 'Envoyé à la facturation'
             LIMIT 1`,
            [user.id, activity.date, activity.analytic_id]
          )
        } else {
          // Strategy 3: No E_CODE, no analytic_id — search by ebrigade_activity_code or name
          existingPrestationResult = await pool.query(
            `SELECT id FROM prestations p
             WHERE p.user_id = $1
             AND p.date = $2
             AND (p.ebrigade_activity_code = $3 OR p.ebrigade_activity_name = $4)
             AND p.status != 'Envoyé à la facturation'
             LIMIT 1`,
            [user.id, activity.date, activity.analytic_code, activity.activity]
          )
        }
        
        const hasPrestation = existingPrestationResult.rows && existingPrestationResult.rows.length > 0
        
        if (!hasPrestation) {
          // Remove the temporary mapping field before returning
          const { _mapping, ...cleanActivity } = activity
          activitiesWithoutPrestations.push(cleanActivity)
        } else {
          console.log('[activities] Skipping activity (prestation exists):', activity.date, activity.analytic_code)
        }
      } catch (filterErr) {
        console.warn('[activities] Error filtering activity:', filterErr.message, 'analytic_id:', activity.analytic_id, 'analytic_code:', activity.analytic_code, 'activity:', activity.activity)
        // Include activity on error (fail open)
        const { _mapping, ...cleanActivity } = activity
        activitiesWithoutPrestations.push(cleanActivity)
      }
    }

    return res.status(200).json({ activities: activitiesWithoutPrestations })
  } catch (err) {
    console.error('[activities]', err)
    return res.status(200).json({ activities: [], error: err.message })
  }
}
