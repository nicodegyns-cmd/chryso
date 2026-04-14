const { getPool } = require('../../../services/db')

export default async function handler(req, res) {
  const pool = getPool()
  
  try {
    if (req.method === 'GET') {
      try {
        const { user_email, date, analytic_code } = req.query || {}
        let q, rows
        if (user_email || date) {
          // Filtered lookup: used by openEdit to find existing same-day prestations
          let whereClauses = []
          let params = []
          let pi = 1
          if (user_email) {
            whereClauses.push(`LOWER(u.email) = LOWER($${pi++})`)
            params.push(user_email)
          }
          if (date) {
            whereClauses.push(`p.date = $${pi++}`)
            params.push(date)
          }
          if (analytic_code) {
            whereClauses.push(`(an.code = $${pi++} OR p.ebrigade_activity_code = $${pi++})`)
            params.push(analytic_code, analytic_code)
            pi++ // already incremented twice above, but pi is local so OK
          }
          const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''
          q = await pool.query(
            `SELECT p.*, u.email AS user_email, an.name AS analytic_name, an.code AS analytic_code
             FROM prestations p
             LEFT JOIN users u ON p.user_id = u.id
             LEFT JOIN analytics an ON p.analytic_id = an.id
             ${where}
             ORDER BY p.date DESC, p.id DESC`,
            params
          )
          rows = (q && q.rows) ? q.rows : []
          return res.status(200).json({ prestations: rows, items: rows })
        }
        q = await pool.query(
          `SELECT p.*, u.email AS user_email, u.first_name AS user_firstname, u.last_name AS user_lastname, an.name AS analytic_name, an.code AS analytic_code,
           (SELECT string_agg(r.code, ',') FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) AS role_codes,
           p.validated_at, p.validated_by_id, p.validated_by_email,
           vuser.first_name AS validated_by_first_name, vuser.last_name AS validated_by_last_name
           FROM prestations p
           LEFT JOIN users u ON p.user_id = u.id
           LEFT JOIN analytics an ON p.analytic_id = an.id
           LEFT JOIN users vuser ON p.validated_by_id = vuser.id
           ORDER BY p.date DESC, p.id DESC`
        )
        rows = (q && q.rows) ? q.rows : []
        return res.status(200).json({ items: rows })
      } catch (e) {
        console.warn('prestations query error', e && e.message)
        return res.status(200).json({ items: [], prestations: [] })
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
      // IMPORTANT: Use analytic_id from request if provided (it comes from /api/activities with correct mapping)
      let resolvedAnalyticId = analytic_id || null
      console.log('[prestations POST] Initial resolvedAnalyticId from request:', resolvedAnalyticId)
      
      let calculatedRemuneInfi = remuneration_infi || null
      let calculatedRemuneMed = remuneration_med || null
      let calculatedRemuneSortieInfi = null
      let calculatedRemuneSortieMed = null

      if (ebrigade_activity_name || ebrigade_activity_code) {
        try {
          // Log debugging info
          console.log('[prestations POST] eBrigade lookup:')
          console.log('  ebrigade_activity_name:', ebrigade_activity_name)
          console.log('  ebrigade_activity_code:', ebrigade_activity_code)
          console.log('  pay_type:', pay_type)
          
          // Extract prefix from eBrigade name (before ' - ' or ' | ')
          const extractPrefix = (name) => {
            if (!name) return null
            const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
            return match ? match[1].trim() : name
          }
          
          const namePrefix = extractPrefix(ebrigade_activity_name)
          console.log('[prestations POST]   Extracted prefix:', namePrefix)
          
          // 1. Find activity via eBrigade NAME mapping (EXACT pattern match on activity name)
          let mappings = []
          let matchedPattern = null
          if (namePrefix) {
            const mappingData = await pool.query(
              `SELECT nm.activity_id, nm.ebrigade_analytic_name_pattern FROM activity_ebrigade_name_mappings nm
               WHERE nm.ebrigade_analytic_name_pattern = $1
               LIMIT 1`,
              [namePrefix]
            )
            mappings = (mappingData && mappingData.rows) ? mappingData.rows : []
            if (mappings.length > 0) {
              matchedPattern = mappings[0].ebrigade_analytic_name_pattern
              console.log('[prestations POST]   ✓ Pattern matched:', matchedPattern, '→ activity_id:', mappings[0].activity_id)
            } else {
              console.log('[prestations POST]   ✗ No exact pattern match for:', namePrefix)
            }
          }
          // Fallback: try old code-based mapping
          if (mappings.length === 0 && ebrigade_activity_code) {
            console.log('[prestations POST]   ⚠️ No name pattern match, trying fallback with code:', ebrigade_activity_code)
            const mappingData2 = await pool.query(
              `SELECT aem.activity_id FROM activity_ebrigade_mappings aem
               WHERE aem.ebrigade_analytic_name = $1 LIMIT 1`,
              [ebrigade_activity_code]
            )
            mappings = (mappingData2 && mappingData2.rows) ? mappingData2.rows : []
            console.log('[prestations POST]   Fallback result:', mappings.length ? `activity_id: ${mappings[0].activity_id}` : 'No match')
          }

          if (mappings && mappings.length > 0) {
            const activityId = mappings[0].activity_id
            
            // 2. Fetch activity + analytic info + detailed tariffs using EXACT PATTERN MATCH
            // This ensures we get the correct activity when multiple exist with same activity_id
            let activityData
            if (matchedPattern) {
              // Use the exact matched pattern for precise lookup
              activityData = await pool.query(
                `SELECT act.id, act.remuneration_infi, act.remuneration_med, act.remuneration_sortie_infi, act.remuneration_sortie_med, act.pay_type, act.analytic_id
                 FROM activities act
                 INNER JOIN activity_ebrigade_name_mappings nm ON act.id = nm.activity_id
                 WHERE nm.activity_id = $1 AND nm.ebrigade_analytic_name_pattern = $2
                 ORDER BY act.date DESC LIMIT 1`,
                [activityId, matchedPattern]
              )
            } else {
              // Fallback to pay_type matching if pattern not available
              activityData = await pool.query(
                `SELECT act.id, act.remuneration_infi, act.remuneration_med, act.remuneration_sortie_infi, act.remuneration_sortie_med, act.pay_type, act.analytic_id
                 FROM activities act
                 WHERE act.id = $1 AND LOWER(act.pay_type) LIKE LOWER($2)
                 ORDER BY act.date DESC LIMIT 1`,
                [activityId, `%${pay_type || ''}%`]
              )
            }
            const activities = (activityData && activityData.rows) ? activityData.rows : []

            if (activities && activities.length > 0) {
              const activity = activities[0]
              console.log('[prestations POST]   ✓ Selected activity:', {
                id: activity.id,
                pay_type: activity.pay_type,
                analytic_id: activity.analytic_id,
                remuneration_infi: activity.remuneration_infi,
                remuneration_med: activity.remuneration_med
              })
              // IMPORTANT: Only use activity.analytic_id as FALLBACK if not already provided in request
              // The analytic_id from API response is the source of truth for the correct local analytics
              if (!resolvedAnalyticId && activity.analytic_id) {
                resolvedAnalyticId = activity.analytic_id
                console.log('[prestations POST]   → Using fallback analytic_id from activity:', resolvedAnalyticId)
              } else if (resolvedAnalyticId && activity.analytic_id && resolvedAnalyticId !== activity.analytic_id) {
                console.log('[prestations POST]   ⚠️ NOTE: Request has analytic_id=' + resolvedAnalyticId + ', activity query returned=' + activity.analytic_id + ' → KEEPING request value')
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
      const { pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, analytic_name, status, ebrigade_id, ebrigade_personnel_id, ebrigade_personnel_name, ebrigade_activity_code, ebrigade_activity_name, ebrigade_activity_type, ebrigade_duration_hours, ebrigade_start_time, ebrigade_end_time, validated_by_email } = req.body || {}

      // If status is being set to "Envoyé à la facturation" and we have the validator email, get their ID
      let validatedById = null
      if (status === "Envoyé à la facturation" && validated_by_email) {
        try {
          const validatorQuery = await pool.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
            [validated_by_email]
          )
          const validatorRows = (validatorQuery && validatorQuery.rows) ? validatorQuery.rows : []
          if (validatorRows.length > 0) {
            validatedById = validatorRows[0].id
          }
        } catch (e) {
          console.warn('Could not find validator user:', e.message)
        }
      }

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
           validated_by_email = CASE WHEN $24::varchar IS NOT NULL THEN $24 ELSE validated_by_email END,
           validated_by_id = CASE WHEN $25::bigint IS NOT NULL THEN $25 ELSE validated_by_id END,
           validated_at = CASE WHEN $24::varchar IS NOT NULL THEN NOW() ELSE validated_at END,
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
        [pay_type, hours_actual, garde_hours, sortie_hours, overtime_hours, remuneration_infi, remuneration_med, comments, expense_amount, expense_comment, proof_image, analytic_id, status, id, ebrigade_id, ebrigade_personnel_id, ebrigade_personnel_name, ebrigade_activity_code, analytic_name || ebrigade_activity_name, ebrigade_activity_type, ebrigade_duration_hours, ebrigade_start_time, ebrigade_end_time, validated_by_email, validatedById]
      )

      const rows = (q && q.rows) ? q.rows : []
      const updated = rows[0] || null

      if (!updated) {
        return res.status(404).json({ error: 'Prestation not found' })
      }
      
      // Fetch the complete prestation data WITH user and analytics JOIN
      const q2 = await pool.query(
        `SELECT p.*, u.email AS user_email, u.first_name AS user_firstname, u.last_name AS user_lastname, an.name AS analytic_name, an.code AS analytic_code,
         p.validated_at, p.validated_by_id, p.validated_by_email,
         vuser.email AS validated_by_user_email, vuser.first_name AS validated_by_first_name, vuser.last_name AS validated_by_last_name
         FROM prestations p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN analytics an ON p.analytic_id = an.id
         LEFT JOIN users vuser ON p.validated_by_id = vuser.id
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
