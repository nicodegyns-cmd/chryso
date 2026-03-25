// pages/api/documents/upload.js
// Upload user documents (RIB, identity documents, etc.)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from '../../../services/db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    const contentType = req.headers['content-type']
    
    // Check if it's form data
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' })
    }

    // Parse form data manually
    const boundary = contentType.split('boundary=')[1]
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid form data' })
    }

    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    
    const bodyBuffer = Buffer.concat(chunks)
    const bodyStr = bodyBuffer.toString()
    
    // Extract file and form fields
    const parts = bodyStr.split(`--${boundary}`)
    let fileData = null
    let fileName = null
    let email = null
    let documentType = 'DOCUMENT'

    for (const part of parts) {
      if (part.includes('filename=')) {
        // This is the file part
        const filenameMatch = part.match(/filename="([^"]+)"/)
        fileName = filenameMatch ? filenameMatch[1] : `document_${Date.now()}.pdf`
        
        // Extract file content (between the headers and boundary)
        const headerEnd = part.indexOf('\r\n\r\n') + 4
        const contentEnd = part.lastIndexOf('\r\n--')
        fileData = Buffer.from(part.slice(headerEnd, contentEnd), 'binary')

        // Validate PDF (check magic bytes)
        const magicBytes = fileData.toString('hex', 0, 4)
        if (!magicBytes.startsWith('25504446')) { // %PDF
          return res.status(400).json({ error: 'File is not a valid PDF' })
        }

        // Validate size (max 5MB)
        if (fileData.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' })
        }
      } else if (part.includes('name="email"')) {
        const match = part.match(/\r\n\r\n(.*?)\r\n/)
        email = match ? match[1].trim() : null
      } else if (part.includes('name="documentType"')) {
        const match = part.match(/\r\n\r\n(.*?)\r\n/)
        documentType = match ? match[1].trim() : 'DOCUMENT'
      }
    }

    // Validate inputs
    if (!fileData) {
      return res.status(400).json({ error: 'No file provided' })
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
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
