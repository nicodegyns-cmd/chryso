// pages/api/documents/upload.js
// Upload user documents (RIB, identity documents, etc.)

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import busboy from 'busboy'

// Create uploads directory if it doesn't exist
// Use /tmp on Vercel (stateless) or public/uploads locally
const uploadsDir = process.env.VERCEL 
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'public', 'uploads')

console.log('[UPLOAD] Using directory:', uploadsDir, 'VERCEL:', process.env.VERCEL ? 'true' : 'false')

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true })
    console.log('[UPLOAD] Directory created successfully')
  } catch (err) {
    console.error('[UPLOAD] Failed to create directory:', err.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[UPLOAD] Starting document upload...')

  try {
    const bb = busboy({ headers: req.headers })
    
    let fileData = null
    let fileName = null
    let email = null
    let documentType = 'DOCUMENT'
    let fileProcessed = false

    return new Promise((resolve) => {
      // Handle field parsing
      bb.on('field', (fieldname, val) => {
        console.log(`[UPLOAD] Field: ${fieldname} = ${val}`)
        if (fieldname === 'email') {
          email = val
        } else if (fieldname === 'documentType') {
          documentType = val
        }
      })

      // Handle file parsing
      bb.on('file', (fieldname, file, info) => {
        console.log(`[UPLOAD] File received: ${info.filename}`)
        fileName = info.filename
        const chunks = []

        file.on('data', (data) => {
          console.log(`[UPLOAD] Received chunk: ${data.length} bytes`)
          chunks.push(data)
        })

        file.on('end', async () => {
          try {
            if (fileProcessed) {
              console.log('[UPLOAD] File already processed, skipping duplicate')
              return
            }
            fileProcessed = true

            console.log(`[UPLOAD] File end event. Total chunks: ${chunks.length}`)
            fileData = Buffer.concat(chunks)
            console.log(`[UPLOAD] File data size: ${fileData.length} bytes`)

            // Validate PDF (check magic bytes)
            const magicBytes = fileData.toString('hex', 0, 4)
            console.log(`[UPLOAD] Magic bytes: ${magicBytes}`)
            if (!magicBytes.startsWith('25504446')) { // %PDF
              console.log('[UPLOAD] Invalid PDF magic bytes')
              return resolve(res.status(400).json({ error: 'File is not a valid PDF' }))
            }

            // Validate size (max 5MB)
            if (fileData.length > 5 * 1024 * 1024) {
              console.log(`[UPLOAD] File too large: ${fileData.length} bytes`)
              return resolve(res.status(400).json({ error: 'File size exceeds 5MB limit' }))
            }

            // Validate email
            if (!email) {
              console.log('[UPLOAD] Email not provided')
              return resolve(res.status(400).json({ error: 'Email is required' }))
            }

            console.log(`[UPLOAD] Email: ${email}, Type: ${documentType}`)

            const pool = getPool()

            // Find user
            console.log('[UPLOAD] Querying user by email...')
            const [userRows] = await pool.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            )

            if (!userRows || userRows.length === 0) {
              console.log(`[UPLOAD] User not found for email: ${email}`)
              return resolve(res.status(404).json({ error: 'User not found' }))
            }

            const userId = userRows[0].id
            console.log(`[UPLOAD] User found: ${userId}`)

            // Generate unique file name
            const timestamp = Date.now()
            const randomStr = Math.random().toString(36).substring(7)
            const safeFileName = `${documentType.toLowerCase()}_${userId}_${timestamp}_${randomStr}.pdf`
            const filePath = path.join(uploadsDir, safeFileName)
            const fileUrl = `/uploads/${safeFileName}`

            console.log(`[UPLOAD] Saving file to: ${filePath}`)

            // Save file to disk
            fs.writeFileSync(filePath, fileData)
            console.log(`[UPLOAD] File saved successfully`)

            // Insert into documents table with validation_status = pending
            console.log('[UPLOAD] Inserting document record into database...')
            const [docRows] = await pool.query(
              `INSERT INTO documents (user_id, name, type, url, file_path, file_size, validation_status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
               RETURNING id`,
              [userId, fileName, 'PDF', fileUrl, filePath, fileData.length]
            )

            console.log(`[UPLOAD] Document created with ID: ${docRows[0].id}`)

            return resolve(res.status(200).json({
              success: true,
              document: {
                id: docRows[0].id,
                name: fileName,
                size: fileData.length,
                url: fileUrl,
                validation_status: 'pending'
              }
            }))
          } catch (err) {
            console.error('[UPLOAD] Error in file processing:', err.message, err.stack)
            return resolve(res.status(500).json({ 
              error: 'Failed to process file',
              details: err.message
            }))
          }
        })

        file.on('error', (err) => {
          console.error('[UPLOAD] File stream error:', err)
          return resolve(res.status(500).json({ error: 'File upload error', details: err.message }))
        })
      })

      bb.on('close', () => {
        console.log('[UPLOAD] Busboy close event')
        if (!fileProcessed && !fileData) {
          return resolve(res.status(400).json({ error: 'No file provided' }))
        }
      })

      bb.on('error', (err) => {
        console.error('[UPLOAD] Busboy error:', err)
        return resolve(res.status(500).json({ error: 'Form parsing error', details: err.message }))
      })

      req.pipe(bb)
    })
  } catch (err) {
    console.error('[UPLOAD] Handler error:', err.message, err.stack)
    return res.status(500).json({ 
      error: 'Upload failed',
      details: err.message
    })
  }
}
