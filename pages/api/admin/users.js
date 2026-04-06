import { getPool } from '../../../services/db'
import bcrypt from 'bcryptjs'
import { sendUserCreationEmail } from '../../../services/emailService'

// Generate a random password (10 characters: mix of letters, numbers, special chars)
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export default async function handler(req, res) {
  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const q = await pool.query('SELECT id, email, role, first_name, last_name, liaison_ebrigade_id, fonction, must_complete_profile, accepted_cgu, accepted_privacy FROM users ORDER BY id DESC')
      const rows = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
      // return rows as-is; `role` may contain comma-separated canonical codes
      return res.status(200).json({ users: rows })
    } catch (err) {
      console.error('[api/admin/users] GET error', err)
      return res.status(500).json({ error: 'db_error' })
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { email, role, firstName, lastName, ninami, telephone, adresse, niss, bce, societe, compte, fonction, liaisonId } = body
    if (!email) return res.status(400).json({ error: 'missing email' })

    // normalize role(s) to canonical codes and store as comma-separated list
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
      // unique preserve order
      return Array.from(new Set(mapped)).join(',') || 'user'
    }
    const roleValue = normalizeRoles(role)

    // Generate a random password and hash it
    const plainPassword = generateRandomPassword()
    const passwordHash = await bcrypt.hash(plainPassword, 10)

    try {
      const q = await pool.query(
        `INSERT INTO users (email, role, first_name, last_name, ninami, telephone, address, niss, bce, company, account, fonction, liaison_ebrigade_id, password_hash, must_complete_profile, accepted_cgu, accepted_privacy, is_active, onboarding_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id`,
        [
          (email || '').toLowerCase(),
          roleValue,
          firstName || null,
          lastName || null,
          ninami || null,
          telephone || null,
          adresse || null,
          niss || null,
          bce || null,
          societe || null,
          compte || null,
          fonction || null,
          liaisonId || null,
          passwordHash,
          true, // must_complete_profile
          false, // accepted_cgu
          false, // accepted_privacy
          false, // is_active = 0 (pending validation)
          'pending_validation' // onboarding_status
        ]
      )

      const result = (q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []
      const insertedId = result && result[0] ? result[0].id : null
      if (!insertedId) throw new Error('Failed to get inserted user ID')
      
      const q2 = await pool.query('SELECT id, email, role, first_name, last_name, liaison_ebrigade_id, fonction, must_complete_profile, accepted_cgu, accepted_privacy FROM users WHERE id = $1', [insertedId])
      const rows = (q2 && q2.rows) ? q2.rows : Array.isArray(q2) ? q2[0] : []
      const user = rows && rows[0] ? rows[0] : null

      console.log('[api/admin/users] Created user with auto-generated password:', { email })

      // Send welcome email with credentials
      const emailResult = await sendUserCreationEmail(
        email,
        plainPassword,
        firstName || null
      )

      // Return the plain password AND email status
      return res.status(201).json({
        user,
        plainPassword,
        emailSent: emailResult.sent,
        emailError: emailResult.error || null,
        message: emailResult.sent
          ? 'User created and email sent successfully'
          : 'User created but email failed to send (check logs)',
      })
    } catch (err) {
      console.error('[api/admin/users] POST error', err)
      return res.status(500).json({ error: 'db_error', detail: err.message })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}
