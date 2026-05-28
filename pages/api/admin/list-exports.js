// pages/api/admin/list-exports.js
// Liste les fichiers PDF de compilation dans public/exports/

const fs = require('fs')
const path = require('path')

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportsDir)) {
      return res.status(200).json({ files: [] })
    }

    const files = fs.readdirSync(exportsDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(exportsDir, f))
        return {
          filename: f,
          url: `/exports/${f}`,
          size: stat.size,
          created_at: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // newest first

    return res.status(200).json({ files })
  } catch (err) {
    console.error('[list-exports]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
