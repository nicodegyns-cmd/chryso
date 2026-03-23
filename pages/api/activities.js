import { getPool } from '../../services/db'

export default async function handler(req, res){
  try{
    if (req.method === 'GET'){
      // Fetch available activities (participations sans heures) from eBrigade for the logged-in user
      
      // Get user email from query
      const { email } = req.query
      if (!email) {
        return res.status(401).json({ error: 'Email required' })
      }

      // Check if EBRIGADE_TOKEN is configured
      if (!process.env.EBRIGADE_TOKEN || !process.env.EBRIGADE_URL) {
        console.log('eBrigade not configured, returning empty')
        return res.status(200).json({ activities: [] })
      }

      // Get pool and fetch user by email to get liaison_ebrigade_id
      const pool = getPool()
      const [[userRow]] = await pool.query(
        'SELECT id, email, liaison_ebrigade_id FROM users WHERE email = $1 LIMIT 1',
        [email]
      )

      if (!userRow) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (!userRow.liaison_ebrigade_id) {
        // User not linked to eBrigade, return empty
        return res.status(200).json({ activities: [] })
      }

      // Get date range: from 2 years ago to 1 year in the future (shows all activities past and future)
      const today = new Date()
      const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
      const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
      const formatDate = (d) => d.toISOString().split('T')[0]
      const dDebut = formatDate(twoYearsAgo)
      const dFin = formatDate(oneYearLater)

      // Call eBrigade API for participations
      const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
      const participationUrl = `${base.replace(/\/$/, '')}/api/export/participation.php`

      const payload = {
        token: process.env.EBRIGADE_TOKEN,
        dDebut,
        dFin
      }

      console.log('[api/activities] Calling eBrigade participation API for user:', {
        email,
        liaison_ebrigade_id: userRow.liaison_ebrigade_id,
        dDebut,
        dFin
      })

      const fetchResponse = await fetch(participationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const text = await fetchResponse.text()
      
      let data
      try {
        data = JSON.parse(text)
      } catch (_) {
        console.error('[api/activities] Invalid JSON from eBrigade:', text.substring(0, 200))
        return res.status(200).json({ activities: [] })
      }

      // Extract participations array 
      let allParticipations = Array.isArray(data) ? data : data.data || data.participations || data.results || []
      
      console.log('[api/activities] Received from eBrigade:', {
        total: allParticipations.length,
        sample: allParticipations[0] ? JSON.stringify(allParticipations[0], null, 2) : 'No data'
      })

      // Filter to only participations for THIS user (P_ID matches liaison_ebrigade_id)
      const userParticipations = allParticipations.filter(p => {
        return p.P_ID && p.P_ID.toString() === userRow.liaison_ebrigade_id.toString()
      })

      // Filter to only participations that don't have hours filled yet
      // Consider empty if: no hours_actual and no remuneration amounts
      const activities = userParticipations.filter(p => {
        const hasHours = p.hours_actual || p.hours_garde || p.hours_permanence || p.hours_total
        const hasRemuneration = p.remuneration_infi || p.remuneration_med || p.amount_total
        return !hasHours && !hasRemuneration
      })

      console.log('[api/activities] Filtered unfilled activities for user:', {
        total: allParticipations.length,
        userParticipations: userParticipations.length,
        unfilled: activities.length
      })

      // Fetch local activities from database to enrich with remuneration data
      let localActivities = []
      try {
        // Fetch without ebrigade_activity_type - use only pay_type for now
        const [rows] = await pool.query(
          'SELECT id, analytic_id, analytic_name, analytic_code, pay_type, remuneration_infi, remuneration_med FROM activities'
        )
        localActivities = rows || []
      } catch (err) {
        console.error('[api/activities] Could not fetch activities:', err.message)
        localActivities = []
      }
      
      // Create single map by pay_type (only source of truth for activity type)
      const localActivitiesByType = {}
      if (Array.isArray(localActivities)) {
        localActivities.forEach(act => {
          if (act.pay_type) {
            const key = act.pay_type.toLowerCase().trim()
            if (!localActivitiesByType[key]) {
              localActivitiesByType[key] = []
            }
            localActivitiesByType[key].push(act)
          }
        })
      }

      console.log('[api/activities] Local activities by pay_type:', {
        types: Object.keys(localActivitiesByType),
        data: Object.entries(localActivitiesByType).map(([type, acts]) => ({ type, count: acts.length }))
      })

      // Transform eBrigade format to our format, enriching with local activity data
      const transformed = activities.map(p => {
        // Get the activity type from eBrigade
        let activityType = ''
        
        // Primary source: TE_LIBELLE (Type d'Engagement - the most reliable field)
        if (p.TE_LIBELLE) {
          activityType = p.TE_LIBELLE.toLowerCase().trim()
        }
        // Fallback: other fields
        else if (p.type) {
          activityType = p.type.toLowerCase().trim()
        }
        else if (p.activity_type) {
          activityType = p.activity_type.toLowerCase().trim()
        }
        // Last resort: extract from E_LIBELLE if it contains the type
        else if (p.E_LIBELLE) {
          const libelle = p.E_LIBELLE.toLowerCase()
          if (libelle.includes('permanence')) activityType = 'permanence'
          else if (libelle.includes('garde')) activityType = 'garde'
          else if (libelle.includes('aps')) activityType = 'aps'
          else if (libelle.includes('sortie')) activityType = 'sortie'
          else if (libelle.includes('formation')) activityType = 'formation'
          else if (libelle.includes('réunion')) activityType = 'réunion'
        }

        console.log(`[api/activities] eBrigade participation:`, {
          ebrigadeType: p.TE_LIBELLE || p.type || p.activity_type || 'unknown',
          normalizedType: activityType,
          E_LIBELLE: p.E_LIBELLE,
          EH_DATE_DEBUT: p.EH_DATE_DEBUT
        })

        // Find matching local activity by pay_type
        let localActivity = (localActivitiesByType[activityType] || [])[0]
        
        console.log(`[api/activities] Matching "${activityType}":`, {
          found: localActivity ? 'yes' : 'no',
          localId: localActivity?.id,
          availableTypes: Object.keys(localActivitiesByType)
        })
        
        return {
          id: `${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`,
          analytic_id: localActivity?.analytic_id || null,
          analytic_name: p.E_LIBELLE || p.name || p.projet || '',
          analytic_code: p.E_CODE || p.code || '',
          // Use local activity pay_type if matched, otherwise use eBrigade value
          pay_type: localActivity?.pay_type || p.TE_LIBELLE || p.type || 'Garde',
          date: p.EH_DATE_DEBUT || p.date || p.date_start || p.start_date,
          startTime: p.EH_DEBUT,
          endTime: p.EH_FIN,
          duration: p.EP_DUREE,
          // Use local activity remuneration if available
          remuneration_infi: localActivity?.remuneration_infi ?? p.remuneration_infi ?? p.rate_infi ?? null,
          remuneration_med: localActivity?.remuneration_med ?? p.remuneration_med ?? p.rate_med ?? null,
          created_at: new Date().toISOString(),
          _ebrigade_raw: p
        }
      })

      return res.status(200).json({ activities: transformed })
    }

    res.setHeader('Allow','GET')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities API error', err)
    res.status(200).json({ activities: [], error: err.message })
  }
}
