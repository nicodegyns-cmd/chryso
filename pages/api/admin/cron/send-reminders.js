/**
 * Cron endpoint: send hour-encoding reminders to users who haven't submitted their hours yet.
 *
 * Strategy: query eBrigade directly for recent activities, cross-reference with our prestations
 * table, and send reminders to users who haven't submitted yet.
 *
 * Rules (based on actual activity end time EH_DATE_FIN):
 *   - R1: 24h ≤ elapsed < 36h → reminder 1 (24h remaining before 48h deadline)
 *   - R2: 36h ≤ elapsed < 48h → reminder 2 / final (12h remaining before 48h deadline)
 *
 * Reminder tracking: reminder_logs table (user_id, activity_date, ebrigade_code, reminder_type)
 *
 * Protected by CRON_SECRET env variable.
 * Call every hour via crontab:
 *   0 * * * * /home/ubuntu/chryso/cron-send-reminders.sh
 */
const { getPool } = require('../../../../services/db')
const { sendReminderEmail } = require('../../../../services/emailService')

export default async function handler(req, res) {
  // Only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET || ''
  if (!cronSecret) {
    console.error('[cron/send-reminders] CRON_SECRET not set in environment')
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Check eBrigade config
  const ebrigadeUrl = (process.env.EBRIGADE_URL || '').replace(/\/$/, '')
  const ebrigadeToken = process.env.EBRIGADE_TOKEN || ''
  if (!ebrigadeUrl || !ebrigadeToken) {
    console.warn('[cron/send-reminders] EBRIGADE_URL or EBRIGADE_TOKEN not configured — skipping')
    return res.status(200).json({ skipped: true, reason: 'eBrigade not configured' })
  }

  const pool = getPool()
  const results = { reminder1: [], reminder2: [], errors: [] }

  try {
    // Ensure reminder_logs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminder_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_date DATE NOT NULL,
        ebrigade_activity_id TEXT,
        reminder_type INTEGER NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Load all users with a liaison_ebrigade_id
    const usersResult = await pool.query(
      `SELECT id, email, first_name, last_name, liaison_ebrigade_id
       FROM users
       WHERE liaison_ebrigade_id IS NOT NULL AND is_active::integer = 1`
    )
    const usersByPID = {}
    for (const u of usersResult.rows) {
      usersByPID[String(u.liaison_ebrigade_id)] = u
    }

    if (Object.keys(usersByPID).length === 0) {
      return res.status(200).json({ skipped: true, reason: 'No users with liaison_ebrigade_id' })
    }

    // Query eBrigade for activities from the past 3 days
    const now = new Date()
    const dFin = now.toISOString().split('T')[0]
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000)
    const dDebut = threeDaysAgo.toISOString().split('T')[0]

    const participationUrl = `${ebrigadeUrl}/api/export/participation.php`
    let allParticipations = []
    try {
      const ebrigadeResp = await fetch(participationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ebrigadeToken, dDebut, dFin }),
      })
      if (!ebrigadeResp.ok) {
        throw new Error(`eBrigade returned HTTP ${ebrigadeResp.status}`)
      }
      allParticipations = await ebrigadeResp.json()
      if (!Array.isArray(allParticipations)) {
        throw new Error('eBrigade response is not an array')
      }
    } catch (fetchErr) {
      console.error('[cron/send-reminders] eBrigade API error:', fetchErr.message)
      return res.status(200).json({ skipped: true, reason: `eBrigade fetch failed: ${fetchErr.message}` })
    }

    console.log(`[cron/send-reminders] eBrigade returned ${allParticipations.length} participations (${dDebut} → ${dFin})`)

    for (const p of allParticipations) {
      try {
        const pid = String(p.P_ID || '')
        const user = usersByPID[pid]
        if (!user) continue

        // Extract activity date from EH_DATE_DEBUT (start), use EH_DATE_FIN (end) for deadline
        const rawDateDebut = p.EH_DATE_DEBUT || ''
        if (!rawDateDebut) continue
        const dateStr = rawDateDebut.split(' ')[0].split('T')[0] // → "YYYY-MM-DD" (date de début)

        // Calculate elapsed hours from actual end time of the activity
        // EH_DATE_FIN format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
        const rawDateFin = p.EH_DATE_FIN || ''
        let endTime
        if (rawDateFin) {
          // Parse end datetime; replace space with T for ISO compatibility
          endTime = new Date(rawDateFin.replace(' ', 'T'))
          // If end time is before start time (overnight: e.g. 20h→08h), end is on the next day
          const rawDebut = new Date(rawDateDebut.replace(' ', 'T'))
          if (endTime <= rawDebut) {
            endTime = new Date(endTime.getTime() + 24 * 3600 * 1000)
          }
        } else {
          // Fallback: use midnight of the start date
          endTime = new Date(dateStr + 'T00:00:00Z')
        }
        const elapsedHours = (now.getTime() - endTime.getTime()) / (1000 * 3600)

        let reminderType = null
        if (elapsedHours >= 24 && elapsedHours < 36) {
          reminderType = 1
        } else if (elapsedHours >= 36 && elapsedHours < 48) {
          reminderType = 2
        }
        if (!reminderType) continue

        // Skip if user already submitted a prestation for this date (any status)
        const prestCheck = await pool.query(
          `SELECT id FROM prestations WHERE user_id = $1 AND date::date = $2::date LIMIT 1`,
          [user.id, dateStr]
        )
        if (prestCheck.rows.length > 0) continue // already submitted

        // Skip if reminder already sent for this user + date + type
        const activityId = `${p.E_CODE || ''}-${dateStr}-${pid}`
        const logCheck = await pool.query(
          `SELECT id FROM reminder_logs
           WHERE user_id = $1 AND activity_date = $2::date AND reminder_type = $3 LIMIT 1`,
          [user.id, dateStr, reminderType]
        )
        if (logCheck.rows.length > 0) continue // already sent

        // Send reminder email
        const hoursLeft = reminderType === 1 ? 24 : 12
        const emailResult = await sendReminderEmail({
          userEmail: user.email,
          firstName: user.first_name || '',
          date: dateStr,
          analyticName: p.E_LIBELLE || '',
          payType: p.TE_LIBELLE || '',
          hoursLeft,
          isLast: reminderType === 2,
        })

        // Log reminder (even if email failed, to avoid retry spam)
        await pool.query(
          `INSERT INTO reminder_logs (user_id, activity_date, ebrigade_activity_id, reminder_type)
           VALUES ($1, $2::date, $3, $4)`,
          [user.id, dateStr, activityId, reminderType]
        )

        const target = reminderType === 1 ? results.reminder1 : results.reminder2
        target.push({ user: user.email, date: dateStr, activity: p.E_LIBELLE || '', sent: emailResult.sent })
        console.log(`[cron/send-reminders] R${reminderType} → ${user.email} (${dateStr}) sent=${emailResult.sent}`)
      } catch (rowErr) {
        results.errors.push({ pid: p.P_ID, error: rowErr.message })
        console.error('[cron/send-reminders] Error processing participation:', rowErr.message)
      }
    }

    const summary = {
      timestamp: now.toISOString(),
      ebrigade_participations: allParticipations.length,
      reminder1_sent: results.reminder1.length,
      reminder2_sent: results.reminder2.length,
      errors: results.errors.length,
      details: results,
    }
    console.log('[cron/send-reminders] Run complete:', JSON.stringify(summary))
    return res.status(200).json(summary)

  } catch (err) {
    console.error('[cron/send-reminders] Fatal error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
