const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req

  const pool = getPool()

  if (method === 'GET') {
    try {
      const q = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, must_complete_profile, accepted_cgu, accepted_privacy, moderator_analytic_ids FROM users WHERE id = $1', [id])
      const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' })
      const u = rows[0]
      // return user as-is; `role` may be a comma-separated list of canonical codes
      return res.status(200).json({ user: u })
    } catch (err) {
      console.error('[api/admin/users/[id]] GET error', err)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = req.body || {}
    const { email, role, firstName, lastName, ninami, telephone, adresse, niss, bce, societe, compte, fonction, liaisonId, acceptedCgu, acceptedPrivacy, moderatorAnalyticIds } = body
    try {
      const normalizeRoles = (r) => {
        const items = Array.isArray(r) ? r.map(String) : (r ? String(r).split(',') : [])
        const mapped = items.map(it => {
            const v = (it||'').toString().toLowerCase()
            if (v.includes('infi') || v.includes('infirm')) return 'INFI'
            if (v.includes('med')) return 'MED'
            if (v === 'admin') return 'admin'
            if (v.includes('moder')) return 'moderator'
            if (v === 'comptabilite' || v.includes('comptab') || v.includes('comptable')) return 'comptabilite'
            return null
          }).filter(Boolean)
        return Array.from(new Set(mapped)).join(',') || null
      }
      
      // Build UPDATE dynamically only including fields that are provided
      const setClauses = []
      const params = []
      let paramIdx = 1
      
      if (typeof email !== 'undefined' && email !== null) {
        setClauses.push(`email = $${paramIdx++}`)
        params.push(email.toLowerCase())
      }
      if (typeof role !== 'undefined' && role !== null) {
        const roleValue = normalizeRoles(role)
        setClauses.push(`role = $${paramIdx++}`)
        params.push(roleValue)
      }
      if (typeof firstName !== 'undefined') {
        setClauses.push(`first_name = $${paramIdx++}`)
        params.push(firstName || null)
      }
      if (typeof lastName !== 'undefined') {
        setClauses.push(`last_name = $${paramIdx++}`)
        params.push(lastName || null)
      }
      if (typeof ninami !== 'undefined') {
        setClauses.push(`ninami = $${paramIdx++}`)
        params.push(ninami || null)
      }
      if (typeof telephone !== 'undefined') {
        setClauses.push(`telephone = $${paramIdx++}`)
        params.push(telephone || null)
      }
      if (typeof adresse !== 'undefined') {
        setClauses.push(`address = $${paramIdx++}`)
        params.push(adresse || null)
      }
      if (typeof niss !== 'undefined') {
        setClauses.push(`niss = $${paramIdx++}`)
        params.push(niss || null)
      }
      if (typeof bce !== 'undefined') {
        setClauses.push(`bce = $${paramIdx++}`)
        params.push(bce || null)
      }
      if (typeof societe !== 'undefined') {
        setClauses.push(`company = $${paramIdx++}`)
        params.push(societe || null)
      }
      if (typeof compte !== 'undefined') {
        setClauses.push(`account = $${paramIdx++}`)
        params.push(compte || null)
      }
      if (typeof fonction !== 'undefined') {
        setClauses.push(`fonction = $${paramIdx++}`)
        params.push(fonction || null)
      }
      if (typeof liaisonId !== 'undefined') {
        setClauses.push(`liaison_ebrigade_id = $${paramIdx++}`)
        params.push(liaisonId || null)
      }
      if (typeof moderatorAnalyticIds !== 'undefined') {
        setClauses.push(`moderator_analytic_ids = $${paramIdx++}`)
        params.push(moderatorAnalyticIds || null)
      }
      
      // Always update timestamp
      setClauses.push(`updated_at = NOW()`)
      
      if (typeof acceptedCgu !== 'undefined') {
        setClauses.push(`accepted_cgu = $${paramIdx++}`)
        params.push(acceptedCgu ? 1 : 0) // Use 1/0 for SMALLINT, not boolean
      }
      if (typeof acceptedPrivacy !== 'undefined') {
        setClauses.push(`accepted_privacy = $${paramIdx++}`)
        params.push(acceptedPrivacy ? 1 : 0) // Use 1/0 for SMALLINT, not boolean
      }
      
      // If both accepted flags set true AND user is not already active, set to pending_validation
      // Do NOT downgrade already-active accounts when they edit their profile
      let alreadyActive = false
      if (acceptedCgu && acceptedPrivacy) {
        const currentQ = await pool.query('SELECT onboarding_status, is_active FROM users WHERE id = $1', [id])
        const currentRows = (currentQ && currentQ.rows) ? currentQ.rows : Array.isArray(currentQ) ? currentQ[0] : []
        const current = currentRows[0]
        alreadyActive = current && (current.onboarding_status === 'active' || current.is_active == 1)
      }
      if (acceptedCgu && acceptedPrivacy && !alreadyActive) {
        setClauses.push(`must_complete_profile = $${paramIdx++}`)
        params.push(0) // false -> 0 for SMALLINT
        setClauses.push(`onboarding_status = $${paramIdx++}`)
        params.push('pending_validation')
        setClauses.push(`is_active = $${paramIdx++}`)
        params.push(0) // false -> 0 for SMALLINT
      }
      
      params.push(id)
      const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`
      await pool.query(sql, params)
      
      const q = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, must_complete_profile, accepted_cgu, accepted_privacy, moderator_analytic_ids FROM users WHERE id = $1', [id])
      const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
      const updatedUser = rows[0]

        // If the user just set acceptedCgu + acceptedPrivacy for the first time -> notify user that account is pending validation
        if (acceptedCgu && acceptedPrivacy && !alreadyActive) {
          try {
            const { send } = require('../../../../services/emailService')
            const appName = process.env.APP_NAME || 'Fenix'
            const appUrl = process.env.APP_URL || 'https://www.sirona-consult.be'
            const html = `<p>Bonjour ${updatedUser.first_name || ''},</p><p>Merci d'avoir complété votre profil. Votre compte est maintenant <strong>en cours de validation</strong> par l'administration. Nous vous informerons par e-mail une fois la validation terminée.</p><p>-- ${appName}</p>`
            const text = `Bonjour ${updatedUser.first_name || ''},\n\nVotre compte est en cours de validation par l'administration. Nous vous informerons par e-mail une fois la validation terminée.`
            await send({ to: updatedUser.email, subject: `${appName} - Compte en cours de validation`, html, text })
          } catch (e) {
            console.warn('Failed to send pending validation email', e)
          }
          
          // Log acceptance event to audit table
          try {
            const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
            await pool.query(`
              INSERT INTO acceptance_audit_log (user_id, email, first_name, last_name, accepted_cgu, accepted_privacy, accepted_at, ip_address)
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
            `, [updatedUser.id, updatedUser.email, updatedUser.first_name, updatedUser.last_name, 1, 1, ip])
          } catch (e) {
            console.warn('Failed to log audit event', e)
          }
        }

      const finalQ = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, must_complete_profile, accepted_cgu, accepted_privacy, moderator_analytic_ids FROM users WHERE id = $1', [id])
      const finalRows = (finalQ && finalQ.rows) ? finalQ.rows : Array.isArray(finalQ) ? finalQ[0] : []
      return res.status(200).json({ user: finalRows[0] })
    } catch (err) {
      console.error('[api/admin/users/[id]] PUT error', err)
      return res.status(500).json({ error: 'db_error', detail: err.message })
    }
  }

  if (method === 'DELETE') {
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [id])
      return res.status(200).json({ success: true, message: 'User deleted' })
    } catch (err) {
      console.error('[api/admin/users/[id]] DELETE error', err)
      return res.status(500).json({ error: 'db_error', detail: err.message })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
  res.status(405).end(`Method ${method} Not Allowed`)
}
