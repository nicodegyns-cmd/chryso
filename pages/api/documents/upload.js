// pages/api/documents/upload.js
// Upload user documents

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import busboy from 'busboy'

const uploadsDir = process.env.VERCEL 
  ? '/tmp/uploads'
  : path.join(process.cwd(), 'public', 'uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[UPLOAD] Start')

  const bb = busboy({ headers: req.headers })
  let sent = false
  let email = null

  const send = (s, d) => {
    if (sent) return
    sent = true
    res.status(s).json(d)
  }

  bb.on('field', (n, v) => {
    if (n === 'email') email = v
  })

  bb.on('file', async (n, f, info) => {
    try {
      const chunks = []
      f.on('data', d => chunks.push(d))
      f.on('end', async () => {
        if (sent) return

        const buf = Buffer.concat(chunks)
        
        // Validate PDF
        if (buf.slice(0, 4).toString('hex') !== '25504446') {
          return send(400, { error: 'Invalid PDF' })
        }

        if (!email) {
          return send(400, { error: 'No email' })
        }

        try {
          const pool = getPool()
          const [users] = await pool.query('SELECT id FROM users WHERE email = $1', [email])

          if (!users?.[0]) {
            return send(404, { error: 'User not found' })
          }

          const userId = users[0].id
          const ts = Date.now()
          const rand = Math.random().toString(36).substring(2, 8)
          const file = path.join(uploadsDir, `doc_${userId}_${ts}_${rand}.pdf`)

          fs.writeFileSync(file, buf)

          const [docs] = await pool.query(
            `INSERT INTO documents (user_id, name, type, file_path, file_size, validation_status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
            [userId, info.filename, 'PDF', file, buf.length, 'pending']
          )

          return send(200, {
            success: true,
            document: {
              id: docs[0].id,
              name: info.filename,
              size: buf.length,
              url: `/api/documents/serve?id=${docs[0].id}`,
              validation_status: 'pending'
            }
          })
        } catch (e) {
          console.error('[UPLOAD] DB error:', e.message)
          return send(500, { error: e.message })
        }
      })
    } catch (e) {
      console.error('[UPLOAD] File error:', e.message)
      return send(500, { error: e.message })
    }
  })

  bb.on('error', e => {
    console.error('[UPLOAD] Parse error:', e.message)
    return send(400, { error: e.message })
  })

  req.pipe(bb)
}
