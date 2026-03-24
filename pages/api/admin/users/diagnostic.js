// Diagnostic API to check eBrigade connectivity
const { query } = require('../../../../services/db')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    configured: {
      ebrigadeUrl: !!process.env.EBRIGADE_URL,
      ebrigadeToken: !!process.env.EBRIGADE_TOKEN
    },
    values: {
      ebrigadeUrl: process.env.EBRIGADE_URL || 'NOT SET',
      ebrigadeToken: process.env.EBRIGADE_TOKEN ? '***MASKED***' : 'NOT SET'
    },
    tests: {}
  }

  // Test 1: eBrigade connectivity
  try {
    const ebrigadeUrl = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
    const ebrigadeToken = process.env.EBRIGADE_TOKEN

    if (!ebrigadeToken) {
      diagnostics.tests.ebrigade_connectivity = {
        status: 'FAILED',
        error: 'EBRIGADE_TOKEN not configured'
      }
    } else {
      const searchUrl = `${ebrigadeUrl.replace(/\/$/, '')}/api/export/search.php`
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ebrigadeToken })
      })

      const responseText = await response.text()
      let data = null
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        // Not JSON
      }

      diagnostics.tests.ebrigade_connectivity = {
        status: response.ok ? 'OK' : 'FAILED',
        statusCode: response.status,
        url: searchUrl,
        rawResponse: responseText.substring(0, 500),  // First 500 chars
        dataType: Array.isArray(data) ? 'array' : (data && data.remote ? 'object_with_remote' : 'other'),
        userCount: Array.isArray(data) ? data.length : (data?.remote ? data.remote.length : 0)
      }
    }
  } catch (err) {
    diagnostics.tests.ebrigade_connectivity = {
      status: 'ERROR',
      error: err.message
    }
  }

  // Test 2: Database connectivity
  try {
    const result = await query('SELECT COUNT(*) as count FROM users')
    diagnostics.tests.database_connectivity = {
      status: 'OK',
      userCount: parseInt(result.rows[0]?.count || 0)
    }
  } catch (err) {
    diagnostics.tests.database_connectivity = {
      status: 'ERROR',
      error: err.message
    }
  }

  res.status(200).json(diagnostics)
}
