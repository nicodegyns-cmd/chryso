// pages/api/documents/upload.js
// Upload user documents

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import { busboy as Busboy } from 'busboy'

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

  console.log('[UPLOAD] Start', req.headers['content-type'])

  const bb = Busboy({ headers: req.headers })
  let sent = false
  let email = null
  let fileData = null
  let fileName = null

  const send = (s, d) => {
    if (sent) return
    sent = true
    res.status(s).json(d)
  }

  bb.on('field', (fieldname, val) => {
    console.log('[UPLOAD] Field:', fieldname)
    if (fieldname === 'email') email = val
  })

  bb.on('file', (fieldname, file, info) => {
    console.log('[UPLOAD] File:', fieldname, info.filename)
    fileName = info.filename
    const chunks = []

    file.on('data', data => {
      chunks.push(data)
    })

    file.on('error', err => {
      console.error('[UPLOAD] File error:', err.message)
      return send(400, { error: 'File read error' })
    })

    file.on('end', async () => {
      console.log('[UPLOAD] File chunks received:', chunks.length)
      fileData = Buffer.concat(chunks)

      // Validate PDF magic bytes
      if (fileData.length < 4 || fileData.slice(0, 4).toString('hex') !== '25504446') {
        console.error('[UPLOAD] Invalid PDF: wrong magic bytes')
        return send(400, { error: 'Invalid PDF file' })
      }

      console.log('[UPLOAD] PDF valid, size:', fileData.length)

      if (!email) {
        return send(400, { error: 'Missing email' })
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

        fs.writeFileSync(file, fileData)
        console.log('[UPLOAD] Saved to:', file)

        const [docs] = await pool.query(
          `INSERT INTO documents (user_id, name, type, file_path, file_size, validation_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [userId, fileName, 'PDF', file, fileData.length, 'pending']
        )

        console.log('[UPLOAD] DB record created:', docs[0].id)
        return send(200, {
          success: true,
          document: {
            id: docs[0].id,
            name: fileName,
            size: fileData.length,
            url: `/api/documents/serve?id=${docs[0].id}`,
            validation_status: 'pending'
          }
        })
      } catch (e) {
        console.error('[UPLOAD] DB error:', e.message)
        return send(500, { error: e.message })
      }
    })
  })

  bb.on('close', () => {
    console.log('[UPLOAD] Busboy closed')
    if (!sent) {
      return send(400, { error: 'No file received' })
    }
  })

  bb.on('error', err => {
    console.error('[UPLOAD] Busboy error:', err.message)
    return send(400, { error: err.message })
  })

  req.pipe(bb)
}
