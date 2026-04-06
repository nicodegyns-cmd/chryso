const { getPool } = require('../../../../services/db')

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req

  const pool = getPool()

  if (method === 'GET') {
    try {
      const q = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, must_complete_profile, accepted_cgu, accepted_privacy FROM users WHERE id = $1', [id])
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
    const { email, role, firstName, lastName, ninami, telephone, adresse, niss, bce, societe, compte, fonction, liaisonId, acceptedCgu, acceptedPrivacy } = body
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
      const roleValue = normalizeRoles(role)
      // If the user completes profile and accepts CGU/privacy, clear must_complete_profile
      const updateParts = []
      const params = []
        let idx = 1
      params.push(email ? email.toLowerCase() : null) // $1
      params.push(roleValue) // $2
      params.push(firstName || null) // $3
      params.push(lastName || null) // $4
      params.push(ninami || null) // $5
      params.push(telephone || null) // $6
      params.push(adresse || null) // $7
      params.push(niss || null) // $8
      params.push(bce || null) // $9
      params.push(societe || null) // $10
      params.push(compte || null) // $11
      params.push(fonction || null) // $12
      params.push(liaisonId || null) // $13
      idx = 14
      let sql = `UPDATE users SET email = $1, role = $2, first_name = $3, last_name = $4, ninami = $5, telephone = $6, address = $7, niss = $8, bce = $9, company = $10, account = $11, fonction = $12, liaison_ebrigade_id = $13, updated_at = NOW()`
      if (typeof acceptedCgu !== 'undefined') {
        params.push(!!acceptedCgu)
        sql += `, accepted_cgu = $${idx}`
        idx++
      }
      if (typeof acceptedPrivacy !== 'undefined') {
        params.push(!!acceptedPrivacy)
        sql += `, accepted_privacy = $${idx}`
        idx++
      }
      // If both accepted flags set true, clear must_complete_profile and set onboarding_status to pending_validation
      if (acceptedCgu && acceptedPrivacy) {
        params.push(false)
        sql += `, must_complete_profile = $${idx}`
        idx++
        params.push('pending_validation')
        sql += `, onboarding_status = $${idx}`
        idx++
      }
      params.push(id)
      sql += ` WHERE id = $${idx}`
      await pool.query(sql, params)
      const q = await pool.query('SELECT id, email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, must_complete_profile, accepted_cgu, accepted_privacy FROM users WHERE id = $1', [id])
      const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
        const updatedUser = rows[0]

        // If the user just set acceptedCgu + acceptedPrivacy -> notify user that account is pending validation
        if (acceptedCgu && acceptedPrivacy) {
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
        }

      return res.status(200).json({ user: rows[0] })
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
