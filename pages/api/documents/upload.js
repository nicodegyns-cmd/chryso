// pages/api/documents/upload.js
// Upload user documents (RIB, identity documents, etc.)

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import busboy from 'busboy'

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const bb = busboy({ headers: req.headers })
    
    let fileData = null
    let fileName = null
    let email = null
    let documentType = 'DOCUMENT'

    return new Promise((resolve) => {
      // Handle field parsing
      bb.on('field', (fieldname, val) => {
        if (fieldname === 'email') {
          email = val
        } else if (fieldname === 'documentType') {
          documentType = val
        }
      })

      // Handle file parsing
      bb.on('file', (fieldname, file, info) => {
        fileName = info.filename
        const chunks = []

        file.on('data', (data) => {
          chunks.push(data)
        })

        file.on('end', async () => {
          try {
            fileData = Buffer.concat(chunks)

            // Validate PDF (check magic bytes)
            const magicBytes = fileData.toString('hex', 0, 4)
            if (!magicBytes.startsWith('25504446')) { // %PDF
              return resolve(res.status(400).json({ error: 'File is not a valid PDF' }))
            }

            // Validate size (max 5MB)
            if (fileData.length > 5 * 1024 * 1024) {
              return resolve(res.status(400).json({ error: 'File size exceeds 5MB limit' }))
            }

            // Validate email
            if (!email) {
              return resolve(res.status(400).json({ error: 'Email is required' }))
            }

            const pool = getPool()

            // Find user
            const [userRows] = await pool.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            )

            if (!userRows || userRows.length === 0) {
              return resolve(res.status(404).json({ error: 'User not found' }))
            }

            const userId = userRows[0].id

            // Generate unique file name
            const timestamp = Date.now()
            const randomStr = Math.random().toString(36).substring(7)
            const safeFileName = `${documentType.toLowerCase()}_${userId}_${timestamp}_${randomStr}.pdf`
            const filePath = path.join(uploadsDir, safeFileName)
            const fileUrl = `/uploads/${safeFileName}`

            // Save file to disk
            fs.writeFileSync(filePath, fileData)

            // Insert into documents table with validation_status = pending
            const [docRows] = await pool.query(
              `INSERT INTO documents (user_id, name, type, url, file_path, file_size, validation_status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
               RETURNING id`,
              [userId, fileName, 'PDF', fileUrl, filePath, fileData.length]
            )

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
            console.error('File processing error:', err)
            return resolve(res.status(500).json({ 
              error: 'Failed to process file',
              details: err.message
            }))
          }
        })

        file.on('error', (err) => {
          console.error('File stream error:', err)
          return resolve(res.status(500).json({ error: 'File upload error' }))
        })
      })

      bb.on('close', () => {
        // All fields and files have been read
        if (!fileData) {
          return resolve(res.status(400).json({ error: 'No file provided' }))
        }
      })

      bb.on('error', (err) => {
        console.error('Busboy error:', err)
        return resolve(res.status(500).json({ error: 'Form parsing error' }))
      })

      req.pipe(bb)
    })
  } catch (err) {
    console.error('Upload handler error:', err)
    return res.status(500).json({ 
      error: 'Upload failed',
      details: err.message
    })
  }
}
