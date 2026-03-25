// pages/api/admin/migrate-document-paths.js
// Fix old document paths

import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()

    // Get all documents with old tmp paths
    const [documents] = await pool.query(`
      SELECT id, file_path FROM documents 
      WHERE file_path LIKE '%/tmp/uploads/%' OR file_path LIKE '%\\uploads\\%'
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
      // Extract filename from path
      const fileName = doc.file_path.split('/').pop() || doc.file_path.split('\\').pop()
      const newPath = `/uploads/${fileName}`

      await pool.query(
        'UPDATE documents SET file_path = $1 WHERE id = $2',
        [newPath, doc.id]
      )
      updated++
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
