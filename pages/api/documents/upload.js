// pages/api/documents/upload.js
// Upload user documents

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import Busboy from 'busboy'

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

  return new Promise((resolve) => {
    const bb = Busboy({ headers: req.headers })
    let sent = false
    let email = null
    let fileProcessed = false

    const send = (s, d) => {
      if (sent) return
      sent = true
      console.log('[UPLOAD] Sending response:', s, d.success || d.error)
      res.status(s).json(d)
      resolve()
    }

    bb.on('field', (fieldname, val) => {
      console.log('[UPLOAD] Field:', fieldname)
      if (fieldname === 'email') email = val
    })

    bb.on('file', (fieldname, file, info) => {
      console.log('[UPLOAD] File received:', fieldname, info.filename)
      const chunks = []

      file.on('data', data => {
        chunks.push(data)
      })

      file.on('end', async () => {
        if (fileProcessed) return
        fileProcessed = true

        console.log('[UPLOAD] File stream ended, chunks:', chunks.length)
        const buf = Buffer.concat(chunks)
        console.log('[UPLOAD] Buffer size:', buf.length)

        // Validate PDF magic bytes
        if (buf.length < 4 || buf.slice(0, 4).toString('hex') !== '25504446') {
          console.error('[UPLOAD] Invalid PDF magic bytes')
          return send(400, { error: 'Invalid PDF file' })
        }

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
          const filePath = path.join(uploadsDir, `doc_${userId}_${ts}_${rand}.pdf`)

          fs.writeFileSync(filePath, buf)
          console.log('[UPLOAD] File saved:', filePath)

          const [docs] = await pool.query(
            `INSERT INTO documents (user_id, name, type, file_path, file_size, validation_status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
            [userId, info.filename, 'PDF', filePath, buf.length, 'pending']
          )

          console.log('[UPLOAD] Database record created:', docs[0].id)
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
          console.error('[UPLOAD] Processing error:', e.message)
          return send(500, { error: e.message })
        }
      })

      file.on('error', err => {
        console.error('[UPLOAD] File stream error:', err.message)
        return send(400, { error: 'File read error' })
      })
    })

    bb.on('error', err => {
      console.error('[UPLOAD] Busboy error:', err.message)
      // Ignore "Unexpected end of form" - it's a known busboy issue on Vercel
      // but the file might still have been received
      if (err.message.includes('Unexpected end of form')) {
        console.log('[UPLOAD] Ignoring Unexpected end of form error')
        return
      }
      if (!sent) {
        return send(400, { error: err.message })
      }
    })

    bb.on('close', () => {
      console.log('[UPLOAD] Busboy closed')
      if (!sent && fileProcessed) {
        // File was processed but response not sent, something went wrong
        return send(500, { error: 'Upload processing failed' })
      }
      if (!sent && !fileProcessed) {
        return send(400, { error: 'No file received' })
      }
    })

    req.pipe(bb)
  })
}
