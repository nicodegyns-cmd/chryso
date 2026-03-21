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
        'SELECT id, email, liaison_ebrigade_id FROM users WHERE email = ? LIMIT 1',
        [email]
      )

      if (!userRow) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (!userRow.liaison_ebrigade_id) {
        // User not linked to eBrigade, return empty
        return res.status(200).json({ activities: [] })
      }

      // Get date range: 7 days from today
      const today = new Date()
      const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const formatDate = (d) => d.toISOString().split('T')[0]
      const dDebut = formatDate(today)
      const dFin = formatDate(sevenDaysLater)

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

      // Transform eBrigade format to our format
      const transformed = activities.map(p => ({
        id: `${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`,
        analytic_id: null,
        analytic_name: p.E_LIBELLE || p.name || p.projet || '',  // e.g., "Garde WEEK-END | 10h - 20h"
        analytic_code: p.E_CODE || p.code || '',
        pay_type: p.TE_LIBELLE || p.type || 'GARDE',  // "Garde", "Permanence", "APS", etc.
        date: p.EH_DATE_DEBUT || p.date || p.date_start || p.start_date,
        startTime: p.EH_DEBUT,  // e.g., "10:00:00"
        endTime: p.EH_FIN,      // e.g., "20:00:00"
        duration: p.EP_DUREE,   // hours
        remuneration_infi: p.remuneration_infi || p.rate_infi || null,
        remuneration_med: p.remuneration_med || p.rate_med || null,
        created_at: new Date().toISOString(),
        // Keep original eBrigade data for reference
        _ebrigade_raw: p
      }))

      return res.status(200).json({ activities: transformed })
    }

    res.setHeader('Allow','GET')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities API error', err)
    res.status(200).json({ activities: [], error: err.message })
  }
}
