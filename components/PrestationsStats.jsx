import React, {useEffect, useMemo, useState} from 'react'

export default function PrestationsStats({ email }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [month, setMonth] = useState('all')
  const [invoiceTotal, setInvoiceTotal] = useState(0)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceError, setInvoiceError] = useState(null)

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

  // Aggregate invoice amounts by calling the server estimate for each prestation
  useEffect(()=>{
    let cancelled = false
    async function computeInvoiceTotal(){
      setInvoiceError(null)
      const invoices = (filtered || []).filter(p => p && p.invoice_number)
      if (!email || invoices.length === 0){ setInvoiceTotal(0); return }
      setInvoiceLoading(true)
      try{
        // Run estimates sequentially to avoid overloading the server / DB pool
        const results = []
        for (const p of invoices){
          if (cancelled) break
          const body = {
            garde_hours: p.garde_hours || 0,
            sortie_hours: p.sortie_hours || 0,
            overtime_hours: p.overtime_hours || 0,
            hours_actual: p.hours_actual || 0,
            pay_type: p.pay_type || '',
            analytic_id: p.analytic_id || null,
            expense_amount: p.expense_amount || 0,
            user_email: email
          }
          // retry a couple times on transient failures
          let attempts = 0
          let value = 0
          while(attempts < 3){
            attempts++
            try{
              const resp = await fetch('/api/prestations/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              })
              if (!resp.ok) throw new Error('Estimate failed')
              const j = await resp.json()
              value = Number(j.estimated_total || 0)
              break
            }catch(e){
              // small backoff
              await new Promise(r => setTimeout(r, 150 * attempts))
            }
          }
          results.push(value)
        }
        if (!cancelled){
          const sum = results.reduce((a,b)=>a+Number(b||0),0)
          setInvoiceTotal(Math.round((sum + Number.EPSILON) * 100) / 100)
        }
      }catch(err){ if (!cancelled) setInvoiceError('Erreur de calcul') }
      finally{ if (!cancelled) setInvoiceLoading(false) }
    }
    computeInvoiceTotal()
    return ()=>{ cancelled = true }
  },[filtered, email])

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
            {invoiceLoading ? (
              <div className="small-muted">Calcul en cours…</div>
            ) : invoiceError ? (
              <div className="small-muted">Erreur: {invoiceError}</div>
            ) : (
              <div style={{fontSize:26,fontWeight:800,color:'#111'}}>{(invoiceTotal || 0).toFixed(2)} EUR</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
