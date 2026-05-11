const { getPool } = require('../../../services/db')

/**
 * GET /api/admin/missing-prestations?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Queries eBrigade for all participations in the given range, then cross-references
 * with the prestations table to find activities that were never submitted.
 * Returns the list grouped for display, plus summary stats.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  const ebrigadeUrl = (process.env.EBRIGADE_URL || '').replace(/\/$/, '')
  const ebrigadeToken = process.env.EBRIGADE_TOKEN || ''

  if (!ebrigadeUrl || !ebrigadeToken) {
    return res.status(200).json({ items: [], totalMissing: 0, usersAffected: 0, skipped: true, reason: 'eBrigade not configured' })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Date range — defaults to last 60 days
  const endDate = req.query.endDate || today
  const defaultStart = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const startDate = req.query.startDate || defaultStart

  try {
    // 1. Query eBrigade for participations in range
    const participationUrl = `${ebrigadeUrl}/api/export/participation.php`
    let allParticipations = []
    try {
      const ebrigadeResp = await fetch(participationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ebrigadeToken, dDebut: startDate, dFin: endDate }),
      })
      if (!ebrigadeResp.ok) throw new Error(`eBrigade HTTP ${ebrigadeResp.status}`)
      const parsed = await ebrigadeResp.json()
      allParticipations = Array.isArray(parsed) ? parsed : []
    } catch (fetchErr) {
      return res.status(500).json({ error: `eBrigade fetch failed: ${fetchErr.message}` })
    }

    const pool = getPool()

    // 2. Load all active users with a liaison_ebrigade_id
    const usersResult = await pool.query(
      `SELECT id, email, first_name, last_name, liaison_ebrigade_id
       FROM users
       WHERE liaison_ebrigade_id IS NOT NULL AND is_active = true`
    )
    const usersByPID = {}
    for (const u of usersResult.rows) {
      usersByPID[String(u.liaison_ebrigade_id)] = u
    }

    // 3. Load all prestations in the date range (any status = submitted)
    const prestaResult = await pool.query(
      `SELECT user_id, date::date AS date FROM prestations WHERE date >= $1 AND date <= $2`,
      [startDate, endDate]
    )
    const submittedSet = new Set()
    for (const p of prestaResult.rows) {
      // date comes back as Date object or string depending on driver — normalise
      const d = typeof p.date === 'string' ? p.date.split('T')[0] : p.date.toISOString().split('T')[0]
      submittedSet.add(`${p.user_id}:${d}`)
    }

    // 4. Determine which eBrigade activities have no matching prestation
    // Deduplicate: one entry per (user, date) — keep the most informative activity
    const seenKeys = new Set()
    const items = []

    for (const p of allParticipations) {
      const pid = String(p.P_ID || '')
      const user = usersByPID[pid]
      if (!user) continue

      const rawDate = (p.EH_DATE_DEBUT || '').split(' ')[0].split('T')[0]
      if (!rawDate || rawDate >= today) continue // skip today and future

      const key = `${user.id}:${rawDate}`
      if (submittedSet.has(key)) continue   // already submitted
      if (seenKeys.has(key)) continue       // deduplicate same user+date
      seenKeys.add(key)

      const activityDate = new Date(rawDate + 'T12:00:00Z')
      const daysAgo = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 3600 * 24))

      items.push({
        user_id: user.id,
        user_email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        date: rawDate,
        activity_name: p.E_LIBELLE || '',
        pay_type: p.TE_LIBELLE || '',
        days_ago: daysAgo,
        ebrigade_code: p.E_CODE || '',
      })
    }

    // Sort: most recent first
    items.sort((a, b) => b.date.localeCompare(a.date))

    const uniqueUsers = new Set(items.map(i => i.user_id))

    return res.status(200).json({
      items,
      totalMissing: items.length,
      usersAffected: uniqueUsers.size,
      ebrigadeTotal: allParticipations.length,
      dateRange: { start: startDate, end: endDate },
    })
  } catch (err) {
    console.error('[missing-prestations] Fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
