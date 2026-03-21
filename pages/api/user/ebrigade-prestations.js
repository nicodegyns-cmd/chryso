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
    // Get user from session
    const { user } = req.session || {}
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get date range from query
    let { dDebut, dFin } = req.query
    
    // Default to current month if not provided
    if (!dDebut || !dFin) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      dDebut = dDebut || `${year}-${month}-01`
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
      dFin = dFin || `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    }

    // Get pool and fetch user's liaison_ebrigade_id
    const pool = getPool()
    const [[userRow]] = await pool.query(
      'SELECT id, email, liaison_ebrigade_id FROM users WHERE id = ? LIMIT 1',
      [user.id]
    )

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

    // Pass liaison_ebrigade_id to filter results on eBrigade side
    const payload = {
      token: process.env.EBRIGADE_TOKEN,
      dDebut,
      dFin,
      user_id: userRow.liaison_ebrigade_id // Use liaison_ebrigade_id to filter for this user
    }

    console.log('[api/user/ebrigade-prestations] Calling eBrigade with:', {
      url: participationUrl,
      dDebut,
      dFin,
      user_id: userRow.liaison_ebrigade_id
    })

    const fetchResponse = await fetch(participationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const text = await fetchResponse.text()
    
    console.log('[api/user/ebrigade-prestations] Raw eBrigade response:', text.substring(0, 500))

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
    // eBrigade returns array directly or nested in data/participations
    let prestations = Array.isArray(data) ? data : data.data || data.participations || data.results || []
    
    console.log('[api/user/ebrigade-prestations] Extracted prestations:', {
      count: prestations.length,
      sample: prestations.length > 0 ? prestations[0] : null
    })

    console.log('[api/user/ebrigade-prestations] Fetched prestations:', {
      userId: user.id,
      count: prestations.length,
      dDebut,
      dFin
    })

    return res.status(200).json({
      success: true,
      dDebut,
      dFin,
      prestations,
      count: prestations.length
    })
  } catch (err) {
    console.error('[api/user/ebrigade-prestations] error', err)
    return res.status(500).json({ error: err.message || 'internal_error' })
  }
}
