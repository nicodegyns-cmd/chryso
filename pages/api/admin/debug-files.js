// pages/api/admin/debug-files.js
import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  try {
    const pool = getPool()

    // Get documents from DB
    const [docs] = await pool.query('SELECT id, file_path, created_at FROM documents LIMIT 5')

    const locations = [
      '/tmp/uploads',
      path.join(process.cwd(), 'public', 'uploads')
    ]

    const filesOnDisk = {}
    for (const dir of locations) {
      try {
        if (fs.existsSync(dir)) {
          filesOnDisk[dir] = fs.readdirSync(dir)
        } else {
          filesOnDisk[dir] = 'DIR_NOT_EXISTS'
        }
      } catch (e) {
        filesOnDisk[dir] = `ERROR: ${e.message}`
      }
    }

    return res.status(200).json({
      documentsInDB: docs,
      filesOnDisk,
      cwd: process.cwd()
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
