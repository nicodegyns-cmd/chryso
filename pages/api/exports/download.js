import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  try {
    const { file } = req.query
    
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'missing file parameter' })
    }

    // Security: only allow prestation PDFs
    if (!file.match(/^prestation-\d+-\d+\.pdf$/)) {
      return res.status(403).json({ error: 'invalid file' })
    }

    const filePath = path.join(process.cwd(), 'public', 'exports', file)
    
    // Prevent directory traversal
    const realPath = path.resolve(filePath)
    const exportsDir = path.resolve(path.join(process.cwd(), 'public', 'exports'))
    
    if (!realPath.startsWith(exportsDir)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'file not found' })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`)
    res.setHeader('Content-Length', fileBuffer.length)
    
    return res.status(200).send(fileBuffer)
  } catch (err) {
    console.error('exports download error', err)
    return res.status(500).json({ error: 'internal server error' })
  }
}
