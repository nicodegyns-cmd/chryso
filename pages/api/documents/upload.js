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
    let fileBuffer = Buffer.alloc(0)

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
      
      file.on('data', (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data])
      })

      file.on('end', () => {
        // Validate PDF (check magic bytes)
        const magicBytes = fileBuffer.toString('hex', 0, 4)
        if (!magicBytes.startsWith('25504446')) { // %PDF
          return
        }
        fileData = fileBuffer
      })
    })

    // Wait for busboy to finish
    await new Promise((resolve, reject) => {
      bb.on('finish', resolve)
      bb.on('error', reject)
      req.pipe(bb)
    })

    // Validate inputs after parsing
    if (!fileData) {
      return res.status(400).json({ error: 'No valid PDF file provided' })
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Validate size (max 5MB)
    if (fileData.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' })
    }

    const pool = getPool()

    // Find user
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userId = userResult.rows[0].id

    // Generate unique file name
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const safeFileName = `${documentType.toLowerCase()}_${userId}_${timestamp}_${randomStr}.pdf`
    const filePath = path.join(uploadsDir, safeFileName)
    const fileUrl = `/uploads/${safeFileName}`

    // Save file to disk
    fs.writeFileSync(filePath, fileData)

    // Insert into documents table with validation_status = pending
    const docResult = await pool.query(
      `INSERT INTO documents (user_id, name, type, url, file_path, file_size, validation_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, fileName, 'PDF', fileUrl, filePath, fileData.length]
    )

    return res.status(200).json({
      success: true,
      document: {
        id: docResult.rows[0].id,
        name: fileName,
        size: fileData.length,
        url: fileUrl,
        validation_status: 'pending'
      }
    })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ 
      error: 'Failed to upload document',
      details: err.message
    })
  }
}
