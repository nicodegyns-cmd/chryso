// pages/api/documents/upload-simple.js
// Simpler upload endpoint without busboy to isolate the issue

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'
    }
  }
}

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.VERCEL 
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'public', 'uploads')

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true })
  } catch (err) {
    console.error('[UPLOAD-SIMPLE] Failed to create directory:', err.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[UPLOAD-SIMPLE] Request received')
  console.log('[UPLOAD-SIMPLE] Content-Type:', req.headers['content-type'])
  console.log('[UPLOAD-SIMPLE] Content-Length:', req.headers['content-length'])

  try {
    // Check if this is a multipart request
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' })
    }

    // For simple testing - just store the raw body
    // In production, we'd use busboy
    const rawBody = req.body
    console.log('[UPLOAD-SIMPLE] Raw body type:', typeof rawBody)
    console.log('[UPLOAD-SIMPLE] Raw body keys:', Object.keys(rawBody || {}))

    return res.status(200).json({
      success: false,
      error: 'This endpoint requires proper multipart parsing. Use /api/documents/upload instead.',
      debug: {
        contentType,
        bodyType: typeof rawBody,
        bodyKeys: Object.keys(rawBody || {})
      }
    })
  } catch (err) {
    console.error('[UPLOAD-SIMPLE] Error:', err.message, err.stack)
    return res.status(500).json({
      error: 'Upload failed',
      details: err.message
    })
  }
}
