// pages/api/documents/upload.js
// Upload user documents

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'
import formidable from 'formidable'

export const config = {
  api: {
    bodyParser: false
  }
}

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[UPLOAD] Start')

  try {
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024 // 5MB
    })

    const [fields, files] = await form.parse(req)
    
    console.log('[UPLOAD] Parsed - fields:', Object.keys(fields), 'files:', Object.keys(files))

    const email = fields.email?.[0]
    if (!email) {
      return res.status(400).json({ error: 'Missing email' })
    }

    const uploadedFile = files.file?.[0]
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    console.log('[UPLOAD] File:', uploadedFile.originalFilename, uploadedFile.size)

    // Validate PDF
    const fileData = fs.readFileSync(uploadedFile.filepath)
    if (fileData.slice(0, 4).toString('hex') !== '25504446') {
      fs.unlinkSync(uploadedFile.filepath)
      return res.status(400).json({ error: 'Invalid PDF file' })
    }

    try {
      const pool = getPool()
      const [users] = await pool.query('SELECT id FROM users WHERE email = $1', [email])

      if (!users?.[0]) {
        fs.unlinkSync(uploadedFile.filepath)
        return res.status(404).json({ error: 'User not found' })
      }

      const userId = users[0].id
      const ts = Date.now()
      const rand = Math.random().toString(36).substring(2, 8)
      const fileName = `doc_${userId}_${ts}_${rand}.pdf`
      const finalPath = path.join(uploadsDir, fileName)
      
      // Move temp file to final location
      fs.copyFileSync(uploadedFile.filepath, finalPath)
      fs.unlinkSync(uploadedFile.filepath)

      console.log('[UPLOAD] Saved to:', finalPath)

      const [docs] = await pool.query(
        `INSERT INTO documents (user_id, name, type, file_path, file_size, validation_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [userId, uploadedFile.originalFilename, 'PDF', `/uploads/${fileName}`, fileData.length, 'pending']
      )

      console.log('[UPLOAD] Success:', docs[0].id)
      return res.status(200).json({
        success: true,
        document: {
          id: docs[0].id,
          name: uploadedFile.originalFilename,
          size: fileData.length,
          url: `/api/documents/serve?id=${docs[0].id}`,
          validation_status: 'pending'
        }
      })
    } catch (e) {
      console.error('[UPLOAD] DB error:', e.message)
      try {
        fs.unlinkSync(uploadedFile.filepath)
      } catch {}
      return res.status(500).json({ error: e.message })
    }
  } catch (err) {
    console.error('[UPLOAD] Parse error:', err.message)
    return res.status(400).json({ error: err.message })
  }
}
