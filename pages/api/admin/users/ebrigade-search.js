// Proxy endpoint to call eBrigade export/search.php from server-side
// Accepts POST with JSON body of search parameters (e.g. { token, lastname, qstrict })
// Returns the raw JSON response from eBrigade.

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST')
    return res.status(405).end('Method Not Allowed')
  }

  let body = req.body || {}
  console.log('[ebrigade-search] Received body:', JSON.stringify(body), 'Content-Type:', req.headers['content-type'])
  
  // Inject server-side token (always required, never exposed to clients)
  if (!process.env.EBRIGADE_TOKEN) {
    return res.status(500).json({ error: 'EBRIGADE_TOKEN not configured' })
  }
  const token = process.env.EBRIGADE_TOKEN
  // Merge body with token (body tokens are ignored for security)
  body = Object.assign({}, body, { token })
  console.log('[ebrigade-search] Merged body:', JSON.stringify(body))
  // prefer server env EBRIGADE_URL if set, otherwise local default
  const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
  const url = `${base.replace(/\/$/, '')}/api/export/search.php`

  try{
    const r = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(body),
      // do not follow insecure SSL rules here; rely on env configuration
    })

    const text = await r.text()
    // try parse JSON, otherwise return text
    try{
      const data = JSON.parse(text)
      return res.status(r.status).json({ remote: data })
    }catch(_){
      return res.status(r.status).json({ remote: text })
    }
  }catch(err){
    console.error('[api/admin/users/ebrigade-search] error', err && err.message)
    return res.status(502).json({ error: 'ebrigade_unreachable', message: err.message })
  }
}
