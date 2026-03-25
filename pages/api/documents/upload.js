// pages/api/documents/upload.js
// Upload user documents - Fixed busboy handler

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import Busboy from 'busboy'

const uploadsDir = process.env.VERCEL 
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'public', 'uploads')

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true })
  } catch (err) {
    console.error('[UPLOAD] Create dir failed:', err.message)
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[UPLOAD] === Start ===')
  console.log('[UPLOAD] Type:', req.headers['content-type']?.substring(0, 40))
  console.log('[UPLOAD] Size:', req.headers['content-length'])

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Invalid Content-Type' })
  }

  let responseSent = false
  let fileBuffer = null
  let fileName = null
  let email = null

  function sendResp(status, data) {
    if (responseSent) return
    responseSent = true
    res.status(status).json(data)
  }

  try {
    const bb = new Busboy({ headers: req.headers })

    bb.on('field', (name, val) => {
      console.log(`[UPLOAD] Field: ${name}`)
      if (name === 'email') email = val
    })

    bb.on('file', (name, file, info) => {
      console.log(`[UPLOAD] File: ${info.filename}`)
      fileName = info.filename
      const chunks = []

      file.on('data', (chunk) => {
        chunks.push(chunk)
      })

      file.on('end', async () => {
        if (responseSent) return

        try {
          fileBuffer = Buffer.concat(chunks)
          console.log(`[UPLOAD] Got ${fileBuffer.length}b`)

          // Validate PDF
          if (fileBuffer.slice(0, 4).toString('hex') !== '25504446') {
            return sendResp(400, { error: 'Invalid PDF' })
          }

          if (!email) {
            return sendResp(400, { error: 'No email' })
          }

          // Save
          const pool = getPool()
          const [users] = await pool.query('SELECT id FROM users WHERE email = $1', [email])

          if (!users || !users[0]) {
            return sendResp(404, { error: 'User not found' })
          }

          const uid = users[0].id
          const ts = Date.now()
          const rand = Math.random().toString(36).substring(2, 8)
          const fpath = path.join(uploadsDir, `doc_${uid}_${ts}_${rand}.pdf`)

          fs.writeFileSync(fpath, fileBuffer)

          const [docs] = await pool.query(
            `INSERT INTO documents (user_id, name, type, file_path, file_size, validation_status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id`,
            [uid, fileName, 'PDF', fpath, fileBuffer.length, 'pending']
          )

          const docId = docs[0].id
          console.log(`[UPLOAD] Done: #${docId}`)

          return sendResp(200, {
            success: true,
            document: {
              id: docId,
              name: fileName,
              size: fileBuffer.length,
              url: `/api/documents/serve?id=${docId}`,
              validation_status: 'pending'
            }
          })
        } catch (err) {
          console.error('[UPLOAD] Error:', err.message)
          return sendResp(500, { error: err.message })
        }
      })

      file.on('error', (err) => {
        console.error('[UPLOAD] File err:', err.message)
        return sendResp(500, { error: 'File error' })
      })
    })

    bb.on('error', (err) => {
      console.error('[UPLOAD] Parse err:', err.message)
      return sendResp(400, { error: `Parse: ${err.message}` })
    })

    bb.on('finish', () => {
      console.log('[UPLOAD] Finish')
      if (!responseSent && !fileBuffer) {
        return sendResp(400, { error: 'No file' })
      }
    })

    console.log('[UPLOAD] Pipe start')
    req.pipe(bb)

  } catch (err) {
    console.error('[UPLOAD] Fatal:', err.message)
    return sendResp(500, { error: err.message })
  }
}
