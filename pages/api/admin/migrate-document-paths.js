// pages/api/admin/migrate-document-paths.js
// Fix old document paths - extract just the filename

import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()

    // Get all documents with old /uploads/ or full paths
    const [documents] = await pool.query(`
      SELECT id, file_path FROM documents 
      WHERE file_path LIKE '%/uploads/%' OR file_path LIKE '%tmp%' OR file_path LIKE '%public%'
    `)

    if (documents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No documents need migration',
        updated: 0
      })
    }

    let updated = 0
    for (const doc of documents) {
      // Extract just the filename from any path
      let fileName = doc.file_path
      if (fileName.includes('/')) {
        fileName = fileName.split('/').pop()
      }
      if (fileName.includes('\\')) {
        fileName = fileName.split('\\').pop()
      }

      // Only update if the filename extracted is different from current
      if (fileName !== doc.file_path) {
        await pool.query(
          'UPDATE documents SET file_path = $1 WHERE id = $2',
          [fileName, doc.id]
        )
        updated++
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${updated} documents`,
      updated
    })
  } catch (error) {
    console.error('[MIGRATE] Error:', error)
    return res.status(500).json({
      error: 'Migration failed',
      details: error.message
    })
  }
}
