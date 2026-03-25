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

    // Try multiple possible file locations
    let fullPath = null
    const possiblePaths = [
      path.join('/tmp/uploads', document.file_path),
      path.join(process.cwd(), 'public', 'uploads', document.file_path),
      document.file_path // If it's already an absolute path
    ]

    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        fullPath = tryPath
        break
      }
    }

    if (!fullPath) {
      console.log(`[SERVE] File not found in any location, tried:`, possiblePaths)
      return res.status(404).json({ error: 'File not found on server' })
    }

    console.log(`[SERVE] File found at: ${fullPath}`)

    // Read and send file
    const fileContent = fs.readFileSync(fullPath)
    console.log(`[SERVE] File read successfully: ${fileContent.length} bytes`)

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${document.name}"`)
    res.setHeader('Content-Length', fileContent.length)

    res.write(fileContent)
    return res.end()
  } catch (err) {
    console.error('[SERVE] Error:', err.message, err.stack)
    return res.status(500).json({
      error: 'Failed to serve document',
      details: err.message
    })
  }
}
