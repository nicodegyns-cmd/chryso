const { getPool } = require('../../../services/db')
const { sendMissingPrestationReminder } = require('../../../services/emailService')

/**
 * POST /api/admin/send-missing-reminder
 * Body: { userId, userEmail, firstName, lastName, date, activityName, payType }
 *
 * Sends a "missing prestation" reminder email for a specific user/date.
 * Checks if the prestation was since submitted before sending.
 * Logs to reminder_logs (type 98 = manual missing reminder).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const { userId, userEmail, firstName, lastName, date, activityName, payType } = req.body || {}

  if (!userEmail || !date) {
    return res.status(400).json({ error: 'userEmail and date are required' })
  }

  try {
    const pool = getPool()

    // Ensure reminder_logs exists with sent_by_email column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminder_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_date DATE NOT NULL,
        ebrigade_activity_id TEXT,
        reminder_type INTEGER NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        sent_by_email TEXT
      )
    `)
    // Add sent_by_email if missing on older table
    await pool.query(`ALTER TABLE reminder_logs ADD COLUMN IF NOT EXISTS sent_by_email TEXT`).catch(() => {})

    // Check if prestation was submitted in the meantime
    if (userId) {
      const check = await pool.query(
        `SELECT id FROM prestations WHERE user_id = $1 AND date::date = $2::date LIMIT 1`,
        [userId, date]
      )
      if (check.rows.length > 0) {
        return res.status(200).json({ sent: false, reason: 'Prestation already submitted' })
      }
    }

    // Send the email (no dedup — admin can always resend)
    const emailResult = await sendMissingPrestationReminder({
      userEmail,
      firstName: firstName || '',
      lastName: lastName || '',
      date,
      activityName: activityName || '',
      payType: payType || '',
    })

    // Log it (reminder_type 98 = manual missing-prestation reminder)
    const adminEmail = req.body.adminEmail || null
    if (userId) {
      try {
        await pool.query(
          `INSERT INTO reminder_logs (user_id, activity_date, ebrigade_activity_id, reminder_type, sent_by_email)
           VALUES ($1, $2::date, $3, 98, $4)`,
          [userId, date, `manual-missing-${date}`, adminEmail]
        )
      } catch (logErr) {
        console.warn('[send-missing-reminder] Could not log:', logErr.message)
      }
    }

    console.log(`[send-missing-reminder] Sent to ${userEmail} for ${date}: sent=${emailResult.sent}`)
    return res.status(200).json(emailResult)
  } catch (err) {
    console.error('[send-missing-reminder] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
