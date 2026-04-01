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
      user_role = '' ,
      user_email = null,
      expense_amount = 0
    } = body

    const round2 = v => Math.round((Number(v||0) + Number.EPSILON) * 100) / 100

    // try to resolve rates from activities via eBrigade mapping or classic analytic_id
    let rateGardeInfi = null, rateGardeMed = null
    let rateSortieInfi = null, rateSortieMed = null
    const FALLBACK_INF = 20
    const FALLBACK_MED = 30

    // Get ebrigade_activity_code if provided in request body
    const ebrigade_activity_code = body.ebrigade_activity_code || null
    let allActs = []

    if (ebrigade_activity_code) {
      // Priority: fetch activities via eBrigade mapping
      try{
        const [mappings] = await pool.query(
          'SELECT activity_id FROM activity_ebrigade_mappings WHERE ebrigade_analytic_name = $1',
          [ebrigade_activity_code]
        )
        if (mappings && mappings.length > 0) {
          const activityIds = mappings.map(m => m.activity_id)
          const [acts] = await pool.query(
            'SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE id = ANY($1) ORDER BY date DESC',
            [activityIds]
          )
          allActs = acts || []
        }
      }catch(e){ /* ignore mapping lookup */ }
    }

    // Fallback: try classic analytic_id if no eBrigade mapping found
    if (allActs.length === 0 && analytic_id) {
      try{
        const [acts] = await pool.query('SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_id = $1 ORDER BY date DESC', [analytic_id])
        allActs = acts || []
      }catch(e){ /* ignore */ }
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
    try{ console.debug('[estimate] resolvedRoles array', resolvedRoles) }catch(e){}
    // Support multi-role CSV stored in `users.role` (e.g. "INFI,admin") and legacy free-text values.
    const resolvedRoles = (resolvedRole && String(resolvedRole).length > 0)
      ? String(resolvedRole).split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
      : []
    const roleLow = (resolvedRole || '').toLowerCase()
    // Prefer canonical token detection (CSV) but fall back to legacy substring heuristics
    const isMed = resolvedRoles.includes('MED') || roleLow.includes('med') || roleLow.includes('médec') || roleLow.includes('doctor') || roleLow.includes('doc')
    const isInfi = resolvedRoles.includes('INFI') || roleLow.includes('infi') || roleLow.includes('infir') || roleLow.includes('infirm') || roleLow.includes('nurs')
    if (isMed) estInfi = 0
    if (isInfi) estMed = 0

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
