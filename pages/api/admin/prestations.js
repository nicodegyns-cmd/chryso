const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method === 'GET') {
      try {
        const q = await pool.query(
          `SELECT p.*, u.email AS user_email, u.first_name AS user_firstname, u.last_name AS user_lastname, an.name AS analytic_name, an.code AS analytic_code
           FROM prestations p
           LEFT JOIN users u ON p.user_id = u.id
           LEFT JOIN analytics an ON p.analytic_id = an.id
           WHERE p.status IN ($1, $2, $3)
           ORDER BY p.date DESC, p.id DESC`,
          ["À saisir", "En attente d'approbation", "En attente d'envoie"]
        )
        const rows = (q && q.rows) ? q.rows : []
        return res.status(200).json({ items: rows })
      } catch (e) {
        console.warn('prestations query error', e && e.message)
        return res.status(200).json({ items: [] })
      }
    }

    if (req.method === 'POST') {
      // Log incoming payload for debugging eBrigade saves (temporary)
      try{
        console.log('[admin/prestations] POST payload keys:', Object.keys(req.body || {}))
        // avoid logging full PII; show specific eBrigade keys presence
        console.log('[admin/prestations] ebrigade keys:', {
          ebrigade_id: !!req.body?.ebrigade_id,
          ebrigade_activity_code: !!req.body?.ebrigade_activity_code,
          ebrigade_activity_type: !!req.body?.ebrigade_activity_type
        })
      }catch(e){/* ignore */}
      const {
        user_email,
        email,
        analytic_id,
        analytic_name,
        date,
        pay_type,
        hours_actual,
        garde_hours,
        sortie_hours,
        overtime_hours,
        remuneration_infi,
        remuneration_med,
        comments,
        expense_amount,
        expense_comment,
        proof_image,
        status,
        // eBrigade data
        ebrigade_id,
        ebrigade_personnel_id,
        ebrigade_personnel_name,
        ebrigade_activity_code,
        ebrigade_activity_name,
        ebrigade_activity_type,
        ebrigade_duration_hours,
        ebrigade_start_time,
        ebrigade_end_time
      } = req.body || {}

      const userEmail = user_email || email
      if (!userEmail) {
        return res.status(400).json({ error: 'user_email required' })
      }

      // Find user by email
      const q1 = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [userEmail.toLowerCase()]
      )
      const users = (q1 && q1.rows) ? q1.rows : []
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      const userId = users[0].id

      // Ensure sortie rate columns exist
      try {
        await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS remuneration_sortie_infi NUMERIC(8,2) DEFAULT NULL")
      } catch(e) {}
      try {
        await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS remuneration_sortie_med NUMERIC(8,2) DEFAULT NULL")
      } catch(e) {}

      // Find local analytique_id and calculate tariffs from eBrigade mappings
      let resolvedAnalyticId = analytic_id || null
      let calculatedRemuneInfi = remuneration_infi || null
      let calculatedRemuneMed = remuneration_med || null
      let calculatedRemuneSortieInfi = null
      let calculatedRemuneSortieMed = null

      if (ebrigade_activity_code) {
        try {
          // 1. Find activity via eBrigade mapping
          const mappingData = await pool.query(
            `SELECT aem.activity_id FROM activity_ebrigade_mappings aem
             WHERE aem.ebrigade_analytic_name = $1 LIMIT 1`,
            [ebrigade_activity_code]
          )
          const mappings = (mappingData && mappingData.rows) ? mappingData.rows : []

          if (mappings && mappings.length > 0) {
            const activityId = mappings[0].activity_id
            
            // 2. Fetch activity + analytic info + detailed tariffs
            const activityData = await pool.query(
              `SELECT act.id, act.remuneration_infi, act.remuneration_med, act.remuneration_sortie_infi, act.remuneration_sortie_med, act.pay_type, act.analytic_id
               FROM activities act
               WHERE act.id = $1 AND LOWER(act.pay_type) LIKE LOWER($2)
               ORDER BY act.date DESC LIMIT 1`,
              [activityId, `%${pay_type || ''}%`]
            )
            const activities = (activityData && activityData.rows) ? activityData.rows : []

            if (activities && activities.length > 0) {
              const activity = activities[0]
              // Store the local analytic_id
              if (activity.analytic_id && !resolvedAnalyticId) {
                resolvedAnalyticId = activity.analytic_id
              }
              // Store DETAILED sortie rates if available
              calculatedRemuneSortieInfi = activity.remuneration_sortie_infi || null
              calculatedRemuneSortieMed = activity.remuneration_sortie_med || null

              // Calculate TOTAL amounts (not hourly rates)
              // Formula: (garde_hours × garde_rate) + (sortie_hours × sortie_rate)
              const gH = Number(garde_hours || 0)
              const sH = Number(sortie_hours || 0)
              const oH = Number(overtime_hours || 0)
              const totalH = Number(hours_actual || 0) || (gH + sH)

              const rateGardeInfi = Number(activity.remuneration_infi || 0)
              const rateGardeMed = Number(activity.remuneration_med || 0)
              const rateSortieInfi = Number(activity.remuneration_sortie_infi || rateGardeInfi)
              const rateSortieMed = Number(activity.remuneration_sortie_med || rateGardeMed)

              if (gH > 0 || sH > 0) {
                // Garde + Sortie breakdown
                if (rateGardeInfi > 0) calculatedRemuneInfi = (gH * rateGardeInfi) + (sH * rateSortieInfi) + (oH * rateGardeInfi)
                if (rateGardeMed > 0) calculatedRemuneMed = (gH * rateGardeMed) + (sH * rateSortieMed) + (oH * rateGardeMed)
              } else if (totalH > 0) {
                // Simple: hours × rate
                if (rateGardeInfi > 0) calculatedRemuneInfi = totalH * rateGardeInfi
                if (rateGardeMed > 0) calculatedRemuneMed = totalH * rateGardeMed
              } else {
                // No hours info, store hourly rates as fallback
                calculatedRemuneInfi = activity.remuneration_infi || calculatedRemuneInfi
                calculatedRemuneMed = activity.remuneration_med || calculatedRemuneMed
              }
            }
          }
        } catch (e) {
          console.warn('[prestations] activity/tariff lookup error:', e && e.message)
          // Continue even if lookup fails
        }
      }

      // Insert new prestation with eBrigade data
      const q2 = await pool.query(
        `INSERT INTO prestations (
          user_id, analytic_id, date, pay_type,
          hours_actual, garde_hours, sortie_hours, overtime_hours,
          remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med,
          comments, expense_amount, expense_comment, proof_image,
          status, created_at, updated_at,
          ebrigade_id, ebrigade_personnel_id, ebrigade_personnel_name, ebrigade_activity_code,
          ebrigade_activity_name, ebrigade_activity_type, ebrigade_duration_hours,
          ebrigade_start_time, ebrigade_end_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), $18, $19, $20, $21, $22, $23, $24, $25, $26) 
        RETURNING *`,
        [
          userId,
          resolvedAnalyticId,
          date || null,
          pay_type || null,
          hours_actual || null,
          garde_hours || null,
          sortie_hours || null,
          overtime_hours || null,
          calculatedRemuneInfi,
          calculatedRemuneMed,
          calculatedRemuneSortieInfi,
          calculatedRemuneSortieMed,
          comments || null,
          expense_amount || null,
          expense_comment || null,
          proof_image || null,
          status || 'À saisir',
          ebrigade_id || null,
          ebrigade_personnel_id || null,
          ebrigade_personnel_name || null,
          ebrigade_activity_code || null,
          ebrigade_activity_name || analytic_name || null,
          ebrigade_activity_type || null,
          ebrigade_duration_hours || null,
          ebrigade_start_time || null,
          ebrigade_end_time || null
        ]
      )

      const resultRows = (q2 && q2.rows) ? q2.rows : []
      const newRow = resultRows[0] || null

      if (!newRow) {
        return res.status(500).json({ error: 'Failed to insert prestation' })
      }
      
      // Fetch the complete prestation data WITH user and analytics JOIN
      const q3 = await pool.query(
        `SELECT p.*, u.email AS user_email, u.first_name AS user_firstname, u.last_name AS user_lastname, an.name AS analytic_name, an.code AS analytic_code
         FROM prestations p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN analytics an ON p.analytic_id = an.id
         WHERE p.id = $1`,
        [newRow.id]
      )
      const completeRows = (q3 && q3.rows) ? q3.rows : []
      const completeRow = completeRows[0] || newRow
      
      return res.status(201).json(completeRow)
    }

    if (req.method === 'PATCH') {
      // Log incoming payload keys for debugging
      try{ console.log('[admin/prestations] PATCH payload keys:', Object.keys(req.body || {})) }catch(e){}
      const { id } = req.query
      const { pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, analytic_name, status, ebrigade_id, ebrigade_personnel_id, ebrigade_personnel_name, ebrigade_activity_code, ebrigade_activity_name, ebrigade_activity_type, ebrigade_duration_hours, ebrigade_start_time, ebrigade_end_time } = req.body || {}

      const q = await pool.query(
        `UPDATE prestations SET
           pay_type = COALESCE($1, pay_type),
           hours_actual = COALESCE($2::numeric, hours_actual),
           garde_hours = COALESCE($3::numeric, garde_hours),
           sortie_hours = COALESCE($4::numeric, sortie_hours),
           overtime_hours = COALESCE($5::numeric, overtime_hours),
           remuneration_infi = COALESCE($6::numeric, remuneration_infi),
           remuneration_med = COALESCE($7::numeric, remuneration_med),
           comments = COALESCE($8, comments),
           expense_amount = COALESCE($9::numeric, expense_amount),
           expense_comment = COALESCE($10, expense_comment),
           proof_image = COALESCE($11, proof_image),
           analytic_id = COALESCE($12, analytic_id),
           status = COALESCE($13, status),
           ebrigade_id = COALESCE($15, ebrigade_id),
           ebrigade_personnel_id = COALESCE($16, ebrigade_personnel_id),
           ebrigade_personnel_name = COALESCE($17, ebrigade_personnel_name),
           ebrigade_activity_code = COALESCE($18, ebrigade_activity_code),
           ebrigade_activity_name = COALESCE($19, ebrigade_activity_name),
           ebrigade_activity_type = COALESCE($20, ebrigade_activity_type),
           ebrigade_duration_hours = COALESCE($21::numeric, ebrigade_duration_hours),
           ebrigade_start_time = COALESCE($22, ebrigade_start_time),
           ebrigade_end_time = COALESCE($23, ebrigade_end_time),
           updated_at = NOW()
         WHERE id = $14
         RETURNING *`,
        [pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, status, id, ebrigade_id, ebrigade_personnel_id, ebrigade_personnel_name, ebrigade_activity_code, analytic_name || ebrigade_activity_name, ebrigade_activity_type, ebrigade_duration_hours, ebrigade_start_time, ebrigade_end_time]
      )

      const rows = (q && q.rows) ? q.rows : []
      const updated = rows[0] || null

      if (!updated) {
        return res.status(404).json({ error: 'Prestation not found' })
      }
      
      // Fetch the complete prestation data WITH user and analytics JOIN
      const q2 = await pool.query(
        `SELECT p.*, u.email AS user_email, u.first_name AS user_firstname, u.last_name AS user_lastname, an.name AS analytic_name, an.code AS analytic_code
         FROM prestations p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN analytics an ON p.analytic_id = an.id
         WHERE p.id = $1`,
        [updated.id]
      )
      const completeRows = (q2 && q2.rows) ? q2.rows : []
      const completeUpdate = completeRows[0] || updated

      return res.status(200).json(completeUpdate)
    }

    res.setHeader('Allow', 'GET,POST,PATCH')
    res.status(405).end('Method Not Allowed')
  } catch (err) {
    console.error('prestations API error', err.message)
    res.status(500).json({ error: err.message || 'internal' })
  }
}
