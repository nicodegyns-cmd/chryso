// pages/api/documents/serve.js
// Serve uploaded document files from database

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
    const result = await pool.query(
      'SELECT id, name, file_data FROM documents WHERE id = $1',
      [id]
    )
    const rows = result.rows || []

    if (!rows || rows.length === 0) {
      console.log(`[SERVE] Document not found: ${id}`)
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = rows[0]
    console.log(`[SERVE] Document found: ${document.name}`)

    // Check if file data exists
    if (!document.file_data) {
      console.log(`[SERVE] No file data for document: ${id}`)
      return res.status(404).json({ error: 'File data not found' })
    }

    // Convert to buffer if needed
    // pg returns BYTEA as hex string '\xDEADBEEF...' by default (text protocol)
    let fileContent
    if (Buffer.isBuffer(document.file_data)) {
      fileContent = document.file_data
    } else if (typeof document.file_data === 'string') {
      const hex = document.file_data.startsWith('\\x')
        ? document.file_data.slice(2)
        : document.file_data
      fileContent = Buffer.from(hex, 'hex')
    } else {
      fileContent = Buffer.from(document.file_data)
    }

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
