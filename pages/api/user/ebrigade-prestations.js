import { getPool } from '../../../services/db'

/**
 * GET endpoint to fetch user's eBrigade participations/prestations
 * Query params: 
 *   - dDebut: start date (YYYY-MM-DD)
 *   - dFin: end date (YYYY-MM-DD)
 * Returns: array of prestations for the connected user
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    // Get user from email parameter (passed from frontend localStorage)
    let { email, dDebut, dFin } = req.query
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Default to 7 days from today if not provided
    if (!dDebut || !dFin) {
      const now = new Date()
      const formatDate = (d) => d.toISOString().split('T')[0]
      dDebut = dDebut || formatDate(now)
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      dFin = dFin || formatDate(sevenDaysLater)
    }

    // Get pool and fetch user by email
    const pool = getPool()
    const q = await pool.query(
      'SELECT id, email, liaison_ebrigade_id FROM users WHERE email = $1 LIMIT 1',
      [email]
    )
    const userRow = (q && q.rows) ? q.rows[0] : null

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user has liaison_ebrigade_id
    if (!userRow.liaison_ebrigade_id) {
      return res.status(400).json({ 
        error: 'no_ebrigade_link',
        message: 'User is not linked to an eBrigade profile'
      })
    }

    // Check if EBRIGADE_TOKEN is configured
    if (!process.env.EBRIGADE_TOKEN || !process.env.EBRIGADE_URL) {
      return res.status(500).json({ error: 'eBrigade not configured' })
    }

    // Call eBrigade API for participations
    const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const participationUrl = `${base.replace(/\/$/, '')}/api/export/participation.php`

    // eBrigade API returns all users' participations, so we request all data
    // and filter by P_ID (liaison_ebrigade_id) client-side
    const payload = {
      token: process.env.EBRIGADE_TOKEN,
      dDebut,
      dFin
    }

    console.log('[api/user/ebrigade-prestations] Calling eBrigade with:', {
      url: participationUrl,
      dDebut,
      dFin,
      liaison_ebrigade_id: userRow.liaison_ebrigade_id
    })

    const fetchResponse = await fetch(participationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const text = await fetchResponse.text()
    
    console.log('[api/user/ebrigade-prestations] Raw eBrigade response length:', text.length)

    let data
    try {
      data = JSON.parse(text)
    } catch (_) {
      return res.status(502).json({ 
        error: 'invalid_ebrigade_response',
        message: 'eBrigade returned invalid JSON'
      })
    }

    // Extract prestations array from response
    // eBrigade returns array directly
    let allPrestations = Array.isArray(data) ? data : data.data || data.participations || data.results || []
    
    console.log('[api/user/ebrigade-prestations] Received from eBrigade:', {
      total: allPrestations.length
    })

    // Filter prestations to only those for this user (P_ID matches liaison_ebrigade_id)
    const prestations = allPrestations.filter(p => {
      return p.P_ID && p.P_ID.toString() === userRow.liaison_ebrigade_id.toString()
    })
    
    console.log('[api/user/ebrigade-prestations] Filtered prestations:', {
      total: allPrestations.length,
      filtered: prestations.length,
      liaison_ebrigade_id: userRow.liaison_ebrigade_id,
      sample: prestations.length > 0 ? prestations[0] : null
    })

    // Load all mapped eBrigade analytics from activity_ebrigade_mappings
    // Only show prestations whose analytics match mapped activities in the database
    let mappedAnalytics = []
    try {
      const mappingsResult = await pool.query(
        'SELECT DISTINCT ebrigade_analytic_name FROM activity_ebrigade_mappings'
      )
      mappedAnalytics = mappingsResult.rows.map(r => r.ebrigade_analytic_name)
      console.log('[api/user/ebrigade-prestations] Loaded mapped analytics:', mappedAnalytics.length)
    } catch (mappingError) {
      console.warn('[api/user/ebrigade-prestations] Could not load mappings, will show all prestations:', mappingError.message)
    }

    // Filter prestations to only those whose code is mapped in database
    // ebrigade_analytic_name now stores CODES directly (e.g., "9610"), not names
    const authorizedPrestations = prestations.filter(p => {
      if (!p.E_CODE) return false
      // Check if this code (E_CODE) exists in our mappings
      return mappedAnalytics.includes(p.E_CODE.toString())
    })

    console.log('[api/user/ebrigade-prestations] After analytics filtering:', {
      before: prestations.length,
      after: authorizedPrestations.length,
      reason: 'Filtered to only mapped activities'
    })

    console.log('[api/user/ebrigade-prestations] Fetched prestations:', {
      userId: userRow.id,
      count: authorizedPrestations.length,
      dDebut,
      dFin
    })

    // Map eBrigade prestations to our format
    const mappedPrestations = authorizedPrestations.map(p => ({
      id: `${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`, // Unique ID for this prestation
      date: p.EH_DATE_DEBUT,
      dateEnd: p.EH_DATE_FIN,
      startTime: p.EH_DEBUT,
      endTime: p.EH_FIN,
      duration: p.EP_DUREE, // hours
      activity: p.E_LIBELLE, // e.g., "Garde WEEK-END | 10h - 20h"
      activityType: p.TE_LIBELLE, // e.g., "Garde"
      activityCode: p.E_CODE,
      personnel: {
        id: p.P_ID,
        phone: p.P_PHONE,
        nom: p.P_NOM,
        prenom: p.P_PRENOM,
        grade: p.P_GRADE
      }
    }))

    return res.status(200).json({
      success: true,
      dDebut,
      dFin,
      prestations: mappedPrestations,
      count: mappedPrestations.length
    })
  } catch (err) {
    console.error('[api/user/ebrigade-prestations] error', err)
    return res.status(500).json({ error: err.message || 'internal_error' })
  }
}
