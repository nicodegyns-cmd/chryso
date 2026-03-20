// Proxy endpoint to call eBrigade export/search.php from server-side
// Accepts POST with JSON body of search parameters (e.g. { token, lastname, qstrict })
// Returns the raw JSON response from eBrigade.

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST')
    return res.status(405).end('Method Not Allowed')
  }

  let body = req.body || {}
  // inject server-side token if available to avoid exposing it to clients
  if (!body.token && process.env.EBRIGADE_TOKEN) body = Object.assign({}, body, { token: process.env.EBRIGADE_TOKEN })
  // prefer server env EBRIGADE_URL if set, otherwise local default
  const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
  const url = `${base.replace(/\/$/, '')}/api/export/search.php`

  try{
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
