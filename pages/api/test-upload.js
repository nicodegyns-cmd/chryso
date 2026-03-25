// pages/api/test-upload.js
// Debug endpoint to test multipart form data parsing

import busboy from 'busboy'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[TEST] === REQUEST DEBUG ===')
  console.log('[TEST] Method:', req.method)
  console.log('[TEST] URL:', req.url)
  console.log('[TEST] Headers:', JSON.stringify(req.headers, null, 2))
  console.log('[TEST] Content-Type:', req.headers['content-type'])
  console.log('[TEST] Content-Length:', req.headers['content-length'])

  try {
    console.log('[TEST] Creating busboy...')
    const bb = busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 10
      }
    })

    let fieldCount = 0
    let fileCount = 0
    let hasFile = false

    bb.on('field', (fieldname, val) => {
      fieldCount++
      console.log(`[TEST] Field #${fieldCount}: ${fieldname} = ${val}`)
    })

    bb.on('file', (fieldname, file, info) => {
      fileCount++
      hasFile = true
      console.log(`[TEST] File #${fileCount}: ${fieldname}, name: ${info.filename}, mimetype: ${info.mimetype}`)
      
      let size = 0
      file.on('data', (chunk) => {
        size += chunk.length
        console.log(`[TEST]   Chunk: ${chunk.length} bytes (total: ${size})`)
      })
      
      file.on('end', () => {
        console.log(`[TEST]   File complete: ${size} bytes total`)
      })
    })

    bb.on('finish', () => {
      console.log(`[TEST] Busboy finish: ${fieldCount} fields, ${fileCount} files`)
    })

    bb.on('error', (err) => {
      console.error('[TEST] Busboy error:', err.message, err.code)
      console.error('[TEST] Stack:', err.stack)
      throw err
    })

    req.on('error', (err) => {
      console.error('[TEST] Request error:', err.message)
      throw err
    })

    return new Promise((resolve) => {
      console.log('[TEST] Piping request...')
      req.pipe(bb)

      setTimeout(() => {
        console.log('[TEST] Request complete')
        resolve(res.status(200).json({
          success: true,
          debug: {
            fieldCount,
            fileCount,
            hasFile,
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length']
          }
        }))
      }, 1000)
    })
  } catch (err) {
    console.error('[TEST] ERROR:', err.message)
    console.error('[TEST] Stack:', err.stack)
    return res.status(500).json({
      error: 'Test error',
      details: err.message,
      stack: err.stack
    })
  }
}
