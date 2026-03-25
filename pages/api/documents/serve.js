// pages/api/documents/serve.js
// Serve uploaded document files from /tmp (Vercel) or public/uploads (local)

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Document ID required' })
  }

  console.log(`[SERVE] Fetching document ${id}...`)

  try {
    const pool = getPool()

    // Get document from database
    const [rows] = await pool.query(
      'SELECT id, name, file_path, user_id FROM documents WHERE id = $1',
      [id]
    )

    if (!rows || rows.length === 0) {
      console.log(`[SERVE] Document not found: ${id}`)
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = rows[0]
    console.log(`[SERVE] Document found: ${document.name}, path: ${document.file_path}`)

    // Check if file exists
    if (!document.file_path || !fs.existsSync(document.file_path)) {
      console.log(`[SERVE] File not found on disk: ${document.file_path}`)
      return res.status(404).json({ error: 'File not found on server' })
    }

    // Read and send file
    const fileContent = fs.readFileSync(document.file_path)
    console.log(`[SERVE] File read successfully: ${fileContent.length} bytes`)

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${document.name}"`)
    res.setHeader('Content-Length', fileContent.length)

    return res.send(fileContent)
  } catch (err) {
    console.error('[SERVE] Error:', err.message, err.stack)
    return res.status(500).json({
      error: 'Failed to serve document',
      details: err.message
    })
  }
}
