const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
    const body = req.body || {}
    const {
      garde_hours = 0,
      sortie_hours = 0,
      overtime_hours = 0,
      hours_actual = 0,
      pay_type = '',
      analytic_id = null,
      analytic_code = null,
      analytic_name = null,
      user_role = '' ,
      user_email = null,
      expense_amount = 0
    } = body

    console.log('[estimate] RECEIVED INPUT:', { garde_hours, sortie_hours, overtime_hours, hours_actual, pay_type, ebrigade_activity_code: body.ebrigade_activity_code })

    const round2 = v => Math.round((Number(v||0) + Number.EPSILON) * 100) / 100

    // try to resolve rates from activities via eBrigade mapping or classic analytic_id
    let rateGardeInfi = null, rateGardeMed = null
    let rateSortieInfi = null, rateSortieMed = null
    const FALLBACK_INF = 20
    const FALLBACK_MED = 30

    // Get ebrigade_activity_code if provided in request body
    const ebrigade_activity_code = body.ebrigade_activity_code || null
    let allActs = []

    // Helper to extract prefix (code) before ' - ' or ' | '
    const extractPrefix = (name) => {
      if (!name) return name
      const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
      return match ? match[1].trim() : name
    }

    if (ebrigade_activity_code) {
      // Priority: fetch activities via eBrigade mapping
      // The ebrigade_activity_code is the E_CODE (e.g., "1001")
      // But activity_ebrigade_mappings stores ebrigade_analytic_name like "1001 - Name"
      // So we need to match by extracting the prefix
      try{
        const [mappings] = await pool.query(
          'SELECT activity_id, ebrigade_analytic_name FROM activity_ebrigade_mappings'
        )
        console.log('[estimate] ALL activity_ebrigade_mappings from DB:', mappings.map(m => ({ activity_id: m.activity_id, ebrigade_analytic_name: m.ebrigade_analytic_name })))
        if (mappings && mappings.length > 0) {
          // Find mapping whose prefix matches our activity code
          const matchingMappings = mappings.filter(m => {
            const mappedPrefix = extractPrefix(m.ebrigade_analytic_name)
            return mappedPrefix === ebrigade_activity_code || m.ebrigade_analytic_name === ebrigade_activity_code
          })
          console.log('[estimate] eBrigade mapping search:', { requested: ebrigade_activity_code, found: matchingMappings.length, mappings: mappings.map(m => m.ebrigade_analytic_name) })
          if (matchingMappings.length > 0) {
            const activityIds = matchingMappings.map(m => m.activity_id)
            console.log('[estimate] Found matching activity_ids:', activityIds)
            const [acts] = await pool.query(
              'SELECT id, pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE id = ANY($1) ORDER BY date DESC',
              [activityIds]
            )
            console.log('[estimate] Activities from DB:', acts)
            allActs = acts || []
          }
        } else {
          console.log('[estimate] NO mappings found in activity_ebrigade_mappings table!')
        }
      }catch(e){ console.log('[estimate] eBrigade mapping lookup failed:', e.message) }
    }

    // Fallback: try classic analytic_id if no eBrigade mapping found
    if (allActs.length === 0 && analytic_id) {
      try{
        const [acts] = await pool.query('SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_id = $1 ORDER BY date DESC', [analytic_id])
        allActs = acts || []
        console.log('[estimate] Found via analytic_id:', allActs)
      }catch(e){ console.log('[estimate] analytic_id lookup failed:', e.message) }
    }

    // Fallback 2: try analytic_code if still no activities found
    if (allActs.length === 0 && analytic_code) {
      try{
        const [acts] = await pool.query('SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_code = $1 ORDER BY date DESC', [analytic_code])
        allActs = acts || []
        console.log('[estimate] Found via analytic_code:', allActs)
      }catch(e){ console.log('[estimate] analytic_code lookup failed:', e.message) }
    }

    // Fallback 3: try analytic_name (search for activities whose name contains the analytic_name keyword)
    if (allActs.length === 0 && analytic_name) {
      try {
        // Extract the main keyword from analytic_name (e.g., "Permanence INFI" from "Permanence INFI | 14h -21h")
        const keyword = extractPrefix(analytic_name)
        console.log('[estimate] Searching for activity by name keyword:', keyword)
        const [acts] = await pool.query(
          'SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_name ILIKE $1 OR name ILIKE $1 ORDER BY date DESC',
          [`%${keyword}%`]
        )
        allActs = acts || []
        console.log('[estimate] Found via analytic_name:', allActs)
      } catch(e) { console.log('[estimate] analytic_name lookup failed:', e.message) }
    }

    if (allActs && allActs.length > 0){
      for (const a of allActs){
        const pt = (a.pay_type||'').toString().toLowerCase()
        if ((rateGardeInfi == null || rateGardeMed == null) && pt.includes('garde')){
          rateGardeInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : rateGardeInfi
          rateGardeMed = a.remuneration_med != null ? Number(a.remuneration_med) : rateGardeMed
        }
        if ((rateSortieInfi == null || rateSortieMed == null) && (pt.includes('sortie') || pt.includes('permanence') || pt.includes('astreinte'))){
          rateSortieInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : rateSortieInfi
          rateSortieMed = a.remuneration_med != null ? Number(a.remuneration_med) : rateSortieMed
        }
        if (rateGardeInfi != null && rateGardeMed != null && rateSortieInfi != null && rateSortieMed != null) break
      }
      if ((rateGardeInfi == null || rateGardeMed == null || rateSortieInfi == null || rateSortieMed == null) && allActs.length > 0){
        const a = allActs[0]
        if (rateGardeInfi == null) rateGardeInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : null
        if (rateGardeMed == null) rateGardeMed = a.remuneration_med != null ? Number(a.remuneration_med) : null
        if (rateSortieInfi == null) rateSortieInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : null
        if (rateSortieMed == null) rateSortieMed = a.remuneration_med != null ? Number(a.remuneration_med) : null
      }
    }

    if (rateGardeInfi == null) rateGardeInfi = FALLBACK_INF
    if (rateGardeMed == null) rateGardeMed = FALLBACK_MED
    if (rateSortieInfi == null) rateSortieInfi = FALLBACK_INF
    if (rateSortieMed == null) rateSortieMed = FALLBACK_MED

    // compute based on pay_type
    const payLower = (pay_type || '').toLowerCase()
    const OT_MULT = 1.5
    let estInfi = 0, estMed = 0
    console.log('[estimate] RATE RESOLUTION:', { rateGardeInfi, rateGardeMed, rateSortieInfi, rateSortieMed, payLower, allActsLength: allActs.length })
    if (payLower.includes('garde')){
      estInfi = (Number(garde_hours) * rateGardeInfi) + (Number(sortie_hours) * rateSortieInfi) + (Number(overtime_hours) * rateGardeInfi * OT_MULT)
      estMed = (Number(garde_hours) * rateGardeMed) + (Number(sortie_hours) * rateSortieMed) + (Number(overtime_hours) * rateGardeMed * OT_MULT)
    } else if (payLower.includes('permanence') || payLower.includes('sortie') || payLower.includes('astreinte')) {
      // For permanence-type activities use the sortie/permanence rates
      estInfi = (Number(hours_actual) * rateSortieInfi) + (Number(overtime_hours) * rateSortieInfi * OT_MULT)
      estMed = (Number(hours_actual) * rateSortieMed) + (Number(overtime_hours) * rateSortieMed * OT_MULT)
    } else {
      // default: use garde rates for generic/unknown pay types (preserve previous behaviour)
      estInfi = (Number(hours_actual) * rateGardeInfi) + (Number(overtime_hours) * rateGardeInfi * OT_MULT)
      estMed = (Number(hours_actual) * rateGardeMed) + (Number(overtime_hours) * rateGardeMed * OT_MULT)
    }
    console.log('[estimate] CALC BEFORE ROLE:', { estInfi, estMed, payLower })

    // Debug: log incoming user role/email
    try{ console.log('[estimate] incoming', { user_role: user_role || null, user_email: user_email || null }) }catch(e){}

    // If caller didn't provide a role, try to resolve it from the user's email in DB
    let resolvedRole = user_role || ''
    if ((!resolvedRole || String(resolvedRole).trim() === '') && user_email){
      try{
        const [urows] = await pool.query('SELECT role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [user_email||''])
        if (urows && urows.length > 0 && urows[0].role) resolvedRole = urows[0].role
      }catch(e){ /* ignore lookup errors */ }
    }
    try{ console.log('[estimate] resolvedRole', resolvedRole) }catch(e){}
    // Support multi-role CSV stored in `users.role` (e.g. "INFI,admin") and legacy free-text values.
    const resolvedRoles = (resolvedRole && String(resolvedRole).length > 0)
      ? String(resolvedRole).split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
      : []
    const roleLow = (resolvedRole || '').toLowerCase()
    // Prefer canonical token detection (CSV) but fall back to legacy substring heuristics
    const isMed = resolvedRoles.includes('MED') || roleLow.includes('med') || roleLow.includes('médec') || roleLow.includes('doctor') || roleLow.includes('doc')
    const isInfi = resolvedRoles.includes('INFI') || roleLow.includes('infi') || roleLow.includes('infir') || roleLow.includes('infirm') || roleLow.includes('nurs')
    console.log('[estimate] ROLE DETECTION:', { resolvedRole, resolvedRoles, isMed, isInfi, estInfiBeforeRole: estInfi, estMedBeforeRole: estMed })
    if (isMed) estInfi = 0
    if (isInfi) estMed = 0
    console.log('[estimate] FINAL CALC:', { estimated_infi: estInfi, estimated_med: estMed })

    const estimated_total = round2(estInfi + estMed + Number(expense_amount || 0))

    // Provide simplified display rates (infi/med) and detailed breakdown (garde/sortie)
    const displayInfi = rateGardeInfi || rateSortieInfi || FALLBACK_INF
    const displayMed = rateGardeMed || rateSortieMed || FALLBACK_MED

    return res.status(200).json({
      estimated_total,
      estimated_infi: round2(estInfi),
      estimated_med: round2(estMed),
      resolved_role: resolvedRole || null,
      resolved_roles: resolvedRoles,
      isMed: !!isMed,
      isInfi: !!isInfi,
      rates: {
        infi: displayInfi,
        med: displayMed,
        overtime_multiplier: OT_MULT,
        detailed: {
          garde_infi: rateGardeInfi,
          garde_med: rateGardeMed,
          sortie_infi: rateSortieInfi,
          sortie_med: rateSortieMed
        }
      }
    })
  }catch(err){
    console.error('estimate API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
