/**
 * Cron endpoint: send hour-encoding reminders to users who haven't declared hours yet.
 * 
 * Rules (prestations date >= 2026-05-01, status = 'À saisir'):
 *   - 24h after prestation date → reminder 1 (24h remaining)
 *   - 36h after prestation date → reminder 2 / final (12h remaining)
 * 
 * Protected by CRON_SECRET env variable.
 * Call every hour via crontab:
 *   0 * * * * curl -s -X POST https://YOUR_DOMAIN/api/admin/cron/send-reminders \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET" >> /home/ubuntu/chryso/cron.log 2>&1
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

  const pool = getPool()
  const results = { reminder1: [], reminder2: [], errors: [] }

  try {
    // Ensure reminder columns exist (idempotent)
    try {
      await pool.query(`ALTER TABLE prestations ADD COLUMN IF NOT EXISTS reminder_1_sent_at TIMESTAMP DEFAULT NULL`)
      await pool.query(`ALTER TABLE prestations ADD COLUMN IF NOT EXISTS reminder_2_sent_at TIMESTAMP DEFAULT NULL`)
    } catch(e) {
      // Columns may already exist, ignore
    }

    // ── REMINDER 1: 24h ≤ elapsed < 36h → "il vous reste 24h" ──────────────
    const r1Query = await pool.query(`
      SELECT
        p.id,
        p.date,
        p.pay_type,
        p.ebrigade_activity_name,
        p.analytic_id,
        u.email    AS user_email,
        u.first_name,
        u.last_name,
        an.name    AS analytic_name
      FROM prestations p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      WHERE p.date >= '2026-05-01'
        AND p.status = 'À saisir'
        AND p.reminder_1_sent_at IS NULL
        AND (NOW() - (p.date::date)::timestamp) >= INTERVAL '24 hours'
        AND (NOW() - (p.date::date)::timestamp) < INTERVAL '36 hours'
    `)
    const reminder1Rows = r1Query.rows || r1Query[0] || []

    for (const row of reminder1Rows) {
      try {
        const emailResult = await sendReminderEmail({
          userEmail: row.user_email,
          firstName: row.first_name || '',
          date: row.date,
          analyticName: row.ebrigade_activity_name || row.analytic_name || '',
          payType: row.pay_type || '',
          hoursLeft: 24,
          isLast: false,
        })
        // Mark as sent regardless of email success to avoid spam on retry
        await pool.query(
          `UPDATE prestations SET reminder_1_sent_at = NOW() WHERE id = $1`,
          [row.id]
        )
        results.reminder1.push({ id: row.id, email: row.user_email, sent: emailResult.sent })
        console.log(`[cron/reminders] R1 sent to ${row.user_email} for prestation ${row.id}`)
      } catch(e) {
        results.errors.push({ id: row.id, step: 'reminder1', error: e.message })
        console.error(`[cron/reminders] R1 failed for prestation ${row.id}:`, e.message)
      }
    }

    // ── REMINDER 2: 36h ≤ elapsed < 48h → "il vous reste 12h" (final) ───────
    const r2Query = await pool.query(`
      SELECT
        p.id,
        p.date,
        p.pay_type,
        p.ebrigade_activity_name,
        p.analytic_id,
        u.email    AS user_email,
        u.first_name,
        u.last_name,
        an.name    AS analytic_name
      FROM prestations p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      WHERE p.date >= '2026-05-01'
        AND p.status = 'À saisir'
        AND p.reminder_2_sent_at IS NULL
        AND (NOW() - (p.date::date)::timestamp) >= INTERVAL '36 hours'
        AND (NOW() - (p.date::date)::timestamp) < INTERVAL '48 hours'
    `)
    const reminder2Rows = r2Query.rows || r2Query[0] || []

    for (const row of reminder2Rows) {
      try {
        const emailResult = await sendReminderEmail({
          userEmail: row.user_email,
          firstName: row.first_name || '',
          date: row.date,
          analyticName: row.ebrigade_activity_name || row.analytic_name || '',
          payType: row.pay_type || '',
          hoursLeft: 12,
          isLast: true,
        })
        await pool.query(
          `UPDATE prestations SET reminder_2_sent_at = NOW() WHERE id = $1`,
          [row.id]
        )
        results.reminder2.push({ id: row.id, email: row.user_email, sent: emailResult.sent })
        console.log(`[cron/reminders] R2 (final) sent to ${row.user_email} for prestation ${row.id}`)
      } catch(e) {
        results.errors.push({ id: row.id, step: 'reminder2', error: e.message })
        console.error(`[cron/reminders] R2 failed for prestation ${row.id}:`, e.message)
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      reminder1_sent: results.reminder1.length,
      reminder2_sent: results.reminder2.length,
      errors: results.errors.length,
      details: results,
    }
    console.log('[cron/reminders] Run complete:', JSON.stringify(summary))
    return res.status(200).json(summary)

  } catch(err) {
    console.error('[cron/reminders] Fatal error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
