import React, { useEffect, useState } from 'react'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import Link from 'next/link'

export default function InvoicesPage() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(()=>{
    async function load(){
      setLoading(true)
      try{
        const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
        if (!email) {
          setInvoices([])
          return
        }
        const r = await fetch(`/api/prestations?email=${encodeURIComponent(email)}`)
        if (!r.ok) throw new Error('Échec récupération')
        const data = await r.json()
        // keep only entries that have a generated PDF (pdf_url)
        const rows = (data.prestations || []).filter(p => p.pdf_url).map(p => ({
          id: p.id,
          date: p.date,
          pdf_url: p.pdf_url,
          invoice_number: p.invoice_number || null,
          request_ref: p.request_ref || null,
          // keep original fields so we can call estimate if needed
          garde_hours: p.garde_hours || 0,
          sortie_hours: p.sortie_hours || 0,
          overtime_hours: p.overtime_hours || 0,
          hours_actual: p.hours_actual || 0,
          pay_type: p.pay_type || '',
          analytic_id: p.analytic_id || null,
          expense_amount: p.expense_amount || 0
        }))

        // fetch estimates in parallel to show a total (lightweight)
        const withTotals = await Promise.all(rows.map(async rRow => {
          try{
            const resp = await fetch('/api/prestations/estimate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
              garde_hours: rRow.garde_hours,
              sortie_hours: rRow.sortie_hours,
              overtime_hours: rRow.overtime_hours,
              hours_actual: rRow.hours_actual,
              pay_type: rRow.pay_type,
              analytic_id: rRow.analytic_id,
              expense_amount: rRow.expense_amount,
              user_email: email
            })})
            if (resp.ok){
              const d = await resp.json()
              return {...rRow, total: d.estimated_total || 0, rates: d.rates}
            }
          }catch(e){ /* ignore */ }
          return {...rRow, total: null}
        }))
        setInvoices(withTotals)
      }catch(e){ console.error(e); setInvoices([]) }
      finally{ setLoading(false) }
    }
    load()
  }, [])

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Mes factures</h1>
          <div className="small-muted">Toutes les factures générées pour votre compte</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          <div className="admin-card card">
            {loading ? (
              <div className="small-muted">Chargement des factures…</div>
            ) : (
              invoices.length === 0 ? (
                <div className="small-muted">Aucune facture générée pour votre compte.</div>
              ) : (
                <div>
                  <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
                    <label style={{display:'flex',alignItems:'center',gap:6}}>Du
                      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}} />
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:6}}>Au
                      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}} />
                    </label>
                    <button onClick={()=>{ setDateFrom(''); setDateTo('') }} style={{padding:'8px 12px',borderRadius:6,border:'none',background:'#e5e7eb',cursor:'pointer'}}>Réinitialiser</button>
                  </div>
                  {/* Responsive card grid for invoices (mobile-friendly) */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                    {invoices
                      .filter(inv => {
                        if (!inv.date) return true
                        if (dateFrom && inv.date < dateFrom) return false
                        if (dateTo && inv.date > dateTo) return false
                        return true
                      })
                      .map(inv => (
                        <div key={inv.id} className="card" style={{padding:12,display:'flex',flexDirection:'column',gap:8,justifyContent:'space-between'}}>
                          <div>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                              <div style={{fontWeight:700,fontSize:16}}>{inv.invoice_number || ('REF '+(inv.request_ref || '#'+inv.id))}</div>
                              <div style={{color:'#6b7280',fontSize:12}}>{inv.date ? inv.date.split('T')[0] : '-'}</div>
                            </div>
                            <div style={{marginTop:8,color:'#374151'}}>
                              <div style={{fontSize:14}}>{inv.request_ref ? inv.request_ref : ('Demande #'+inv.id)}</div>
                            </div>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                            <div style={{fontWeight:700}}>{inv.total != null ? (Number(inv.total).toFixed(2)+' €') : '—'}</div>
                            <div style={{display:'flex',gap:8}}>
                              <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{background:'#0366d6',color:'#fff',padding:'6px 10px',borderRadius:6,textDecoration:'none'}}>Voir PDF</a>
                              <Link href={inv.pdf_url} legacyBehavior><a style={{padding:'6px 10px',borderRadius:6,border:'1px solid #d1d5db',background:'#fff',textDecoration:'none'}}>Télécharger</a></Link>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
