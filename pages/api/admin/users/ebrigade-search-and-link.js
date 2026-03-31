const { getPool } = require('../../../../services/db')

// POST { email | user_id, search: { lastname, ... }, token? }
// Uses server env EBRIGADE_URL and EBRIGADE_TOKEN if available, otherwise requires token in body.
export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST')
    return res.status(405).end('Method Not Allowed')
  }

  const { email, user_id, search = {}, token: bodyToken } = req.body || {}
  const token = process.env.EBRIGADE_TOKEN || bodyToken
  const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'

  if (!token) return res.status(400).json({ error: 'missing_ebrigade_token' })
  if (!email && !user_id) return res.status(400).json({ error: 'missing_target_user' })

  // Prepare payload for eBrigade
  const payload = Object.assign({}, search, { token })

  try{
    const url = `${base.replace(/\/$/, '')}/api/export/search.php`
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    const text = await r.text()
    let remote
    try{ remote = JSON.parse(text) }catch(_){ remote = text }

    // Try to extract single-match ebrigade id
    let candidate = null
    if (Array.isArray(remote)){
      if (remote.length === 1) candidate = remote[0]
    } else if (remote && typeof remote === 'object'){
      // common patterns: { data: [...] } or { results: [...] }
      if (Array.isArray(remote.data) && remote.data.length === 1) candidate = remote.data[0]
      else if (Array.isArray(remote.results) && remote.results.length === 1) candidate = remote.results[0]
      else if (remote.count === 1 && Array.isArray(remote.rows) && remote.rows.length === 1) candidate = remote.rows[0]
      else if (remote && (remote.id || remote.uid || remote.user_id)) candidate = remote
    }

    if (!candidate) return res.status(200).json({ matched: false, remote })

    // find id in candidate object
    const idKeys = ['ebrigade_id','id','uid','user_id','person_id','id_person','ext_id']
    let ebrigadeId = null
    for (const k of idKeys){ if (candidate[k] != null){ ebrigadeId = String(candidate[k]); break } }

    // fallback: if candidate is a string or number
    if (!ebrigadeId && (typeof candidate === 'string' || typeof candidate === 'number')) ebrigadeId = String(candidate)

    if (!ebrigadeId) return res.status(200).json({ matched: true, but_no_id_found: true, candidate })

    // Update local DB
    const pool = getPool()
    let q, params
    if (user_id){ q = 'UPDATE users SET ebrigade_id = ? WHERE id = ?'; params = [ebrigadeId, user_id] }
    else { q = 'UPDATE users SET ebrigade_id = ? WHERE LOWER(email) = ?'; params = [ebrigadeId, String(email).toLowerCase()] }

    const [result] = await pool.query(q, params)
    if (result.affectedRows === 0) return res.status(404).json({ error: 'user_not_found' })

    const [rows] = await pool.query('SELECT id, email, ebrigade_id FROM users WHERE ebrigade_id = ? LIMIT 1', [ebrigadeId])
    return res.status(200).json({ matched: true, linked: true, ebrigadeId, user: (rows && rows[0]) || null })
  }catch(err){
    console.error('[api/admin/users/ebrigade-search-and-link] error', err && err.message)
    return res.status(500).json({ error: 'ebrigade_error', message: err.message })
  }
}
