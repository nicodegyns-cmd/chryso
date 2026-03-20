const { getPool } = require('../../../services/db')

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'missing id' })
  const pool = getPool()
  try{
    const [[row]] = await pool.query('SELECT * FROM prestations WHERE id = ? LIMIT 1', [id])
    if (!row) return res.status(404).json({ error: 'not_found' })

    // Ensure invoice_number column exists
    try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64) DEFAULT NULL") }catch(e){}
    try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS request_ref VARCHAR(64) DEFAULT NULL") }catch(e){}

    const updated = Object.assign({}, row)

    // Generate invoice_number if missing
    if (!updated.invoice_number){
      try{
        const year = new Date().getFullYear()
        const like = `${year}-%`
        const [resInv] = await pool.query('SELECT invoice_number FROM prestations WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1', [like])
        let nextNum = 1
        if (resInv && resInv.length > 0 && resInv[0].invoice_number){
          const parts = String(resInv[0].invoice_number).split('-')
          const last = parts[1] || ''
          const n = parseInt(last.replace(/^0+/, '') || '0', 10)
          if (!isNaN(n)) nextNum = n + 1
        }
        const padded = String(nextNum).padStart(5, '0')
        const newInv = `${year}-${padded}`
        await pool.query('UPDATE prestations SET invoice_number = ? WHERE id = ?', [newInv, id])
        updated.invoice_number = newInv
      }catch(e){ /* ignore */ }
    }

    // Generate request_ref if missing — produce a simple 5-digit prestation reference (e.g. "00001")
    if (!updated.request_ref){
      try{
        // Prefer existing pure numeric references (5 digits). If none, fall back to old REQ-YYYY-xxxxx pattern to continue sequence.
        const [resNum] = await pool.query('SELECT request_ref FROM prestations WHERE request_ref REGEXP ? ORDER BY request_ref DESC LIMIT 1', ['^[0-9]{5}$'])
        let nextReq = 1
        if (resNum && resNum.length > 0 && resNum[0].request_ref){
          const n = parseInt(String(resNum[0].request_ref).replace(/^0+/, '') || '0', 10)
          if (!isNaN(n)) nextReq = n + 1
        } else {
          // fallback: look for legacy REQ-YYYY-xxxxx entries and continue that numeric part
          const yearR = new Date().getFullYear()
          const likeR = `REQ-${yearR}-%`
          const [resReq] = await pool.query('SELECT request_ref FROM prestations WHERE request_ref LIKE ? ORDER BY request_ref DESC LIMIT 1', [likeR])
          if (resReq && resReq.length > 0 && resReq[0].request_ref){
            const parts = String(resReq[0].request_ref).split('-')
            const last = parts[2] || ''
            const n = parseInt(last.replace(/^0+/, '') || '0', 10)
            if (!isNaN(n)) nextReq = n + 1
          }
        }
        const paddedR = String(nextReq).padStart(5, '0')
        const newReq = paddedR
        await pool.query('UPDATE prestations SET request_ref = ? WHERE id = ?', [newReq, id])
        updated.request_ref = newReq
      }catch(e){ /* ignore */ }
    }

    // Return refreshed row
    const [[refreshed]] = await pool.query('SELECT * FROM prestations WHERE id = ? LIMIT 1', [id])
    return res.status(200).json({ prestation: refreshed })
  }catch(err){
    console.error('[generate_invoice_number] error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
