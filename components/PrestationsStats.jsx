import React, {useEffect, useMemo, useState} from 'react'

export default function PrestationsStats({ email, role }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [month, setMonth] = useState('all')
  const [invoiceTotal, setInvoiceTotal] = useState(0)

  useEffect(()=>{
    if (!email){ setItems([]); setLoading(false); return }
    setLoading(true); setError(null)
    fetch(`/api/prestations?email=${encodeURIComponent(email)}`)
      .then(r=>{ if(!r.ok) throw new Error('Échec') ; return r.json() })
      .then(d=> setItems(d.prestations || []))
      .catch(e=> setError(e.message || 'Erreur'))
      .finally(()=> setLoading(false))
  },[email])

  const months = useMemo(()=>{
    const s = new Set()
    items.forEach(p=>{
      if (p && p.date){ const m = p.date.slice(0,7); s.add(m) }
    })
    return Array.from(s).sort((a,b)=> b.localeCompare(a))
  },[items])

  const filtered = useMemo(()=>{
    if (month === 'all') return items
    return items.filter(p=> p && p.date && p.date.startsWith(month))
  },[items,month])

  const totals = useMemo(()=>{
    let infi = 0, med = 0, expenses = 0
    for (const p of filtered){
      if (p.remuneration_infi != null) infi += Number(p.remuneration_infi) || 0
      if (p.remuneration_med != null) med += Number(p.remuneration_med) || 0
      if (p.expense_amount != null) expenses += Number(p.expense_amount) || 0
    }
    return {infi, med, expenses, overall: infi + med + expenses}
  },[filtered])

  // Compute invoice total directly from stored remuneration values (same values used on the actual PDF invoice)
  useEffect(()=>{
    const roleLow = (role || '').toLowerCase()
    const isMed = roleLow.includes('med') || roleLow.includes('médec') || roleLow.includes('doctor')
    const isInfi = roleLow.includes('infi') || roleLow.includes('infir') || roleLow.includes('nurs')
    const invoices = (filtered || []).filter(p => p && p.invoice_number)
    const sum = invoices.reduce((acc, p) => {
      let remu = 0
      if (isMed) remu = Number(p.remuneration_med) || 0
      else if (isInfi) remu = Number(p.remuneration_infi) || 0
      else remu = (Number(p.remuneration_infi) || 0) + (Number(p.remuneration_med) || 0)
      return acc + remu + (Number(p.expense_amount) || 0)
    }, 0)
    setInvoiceTotal(Math.round((sum + Number.EPSILON) * 100) / 100)
  },[filtered, role])

  return (
    <div className="card" style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h3 style={{margin:'0 0 4px 0'}}>Statistiques</h3>
          <div className="small-muted">Montants facturés</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label className="small-muted" style={{fontSize:13,marginRight:6}}>Période</label>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e6e9ef'}}>
            <option value="all">Tous</option>
            {months.map(m=> <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="small-muted">Chargement…</div>
      ) : error ? (
        <div className="small-muted">Erreur: {error}</div>
      ) : (
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:'1 1 320px',background:'#fff',padding:16,borderRadius:8,border:'1px solid #eef2f7'}}>
            <div className="small-muted">Total facturé</div>
              <div style={{fontSize:26,fontWeight:800,color:'#111'}}>{(invoiceTotal || 0).toFixed(2)} EUR</div>
          </div>
        </div>
      )}
    </div>
  )
}
