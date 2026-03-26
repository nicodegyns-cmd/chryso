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
  const [role, setRole] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [analyticFilter, setAnalyticFilter] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [analytics, setAnalytics] = useState([])

  useEffect(()=>{
    async function load(){
      setLoading(true)
      try{
        const rRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null
        setRole(rRole)

        // Comptabilité users: show invoices pending in invoices table
        if (rRole === 'comptabilite') {
          const res = await fetch('/api/admin/invoices?status=pending')
          if (!res.ok) throw new Error('Échec récupération')
          const data = await res.json()
          // Normalize db wrapper response: some endpoints return [rows, meta]
          let rows = []
          if (Array.isArray(data)) {
            if (Array.isArray(data[0])) rows = data[0]
            else rows = data
          } else if (data && Array.isArray(data.invoices)) {
            rows = data.invoices
          } else {
            rows = []
          }
          setInvoices(rows)
          return
        }

        // Default: user view - fetch prestations for this user and keep those with pdf
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

  // load analytics list for filters when role becomes comptabilite
  useEffect(()=>{
    if (role !== 'comptabilite') return
    let cancelled = false
    async function loadAnalytics(){
      try{
        const r = await fetch('/api/analytics')
        if (!r.ok) return
        const d = await r.json()
        if (cancelled) return
        setAnalytics(d.items || d || [])
      }catch(e){ /* ignore */ }
    }
    loadAnalytics()
    return () => { cancelled = true }
  }, [role])

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Factures</h1>
          <div className="small-muted">Toutes les factures générées pour votre compte</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          <div className="admin-card card">
            {loading ? (
              <div className="small-muted">Chargement des factures…</div>
            ) : invoices.length === 0 ? (
              <div className="small-muted">Aucune facture trouvée.</div>
              ) : (
                // If comptabilite role, show table of invoices from invoices table
                role === 'comptabilite' ? (
                  <div>
                    <div style={{marginBottom:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <input placeholder="Rechercher (n° facture, client)" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #e5e7eb',minWidth:220}} />
                      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #e5e7eb'}}>
                        <option value="tous">Tous statuts</option>
                        <option value="pending">En attente</option>
                        <option value="paid">Payée</option>
                        <option value="overdue">En retard</option>
                        <option value="cancelled">Annulée</option>
                      </select>
                      <select value={analyticFilter} onChange={e=>setAnalyticFilter(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #e5e7eb'}}>
                        <option value="">Tous analytiques</option>
                        {analytics.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
                      </select>
                      <label style={{display:'flex',alignItems:'center',gap:6}}>Du
                        <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}} />
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:6}}>Au
                        <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}} />
                      </label>
                      <button onClick={()=>{ setSearch(''); setStatusFilter('tous'); setAnalyticFilter(''); setFilterDateFrom(''); setFilterDateTo('') }} style={{padding:'8px 12px',borderRadius:6,border:'none',background:'#e5e7eb',cursor:'pointer'}}>Réinitialiser</button>
                    </div>
                    <div style={{overflowX: 'auto'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr style={{background: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                            <th style={{padding: 12, textAlign: 'left'}}>N° Facture</th>
                            <th style={{padding: 12, textAlign: 'left'}}>Analytique</th>
                            <th style={{padding: 12, textAlign: 'left'}}>Client</th>
                            <th style={{padding: 12, textAlign: 'left'}}>Montant</th>
                            <th style={{padding: 12, textAlign: 'left'}}>Date</th>
                            <th style={{padding: 12, textAlign: 'left'}}>Statut</th>
                            <th style={{padding: 12, textAlign: 'center'}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.filter(Boolean).map((inv, idx) => (
                            <tr key={inv.id || idx} style={{borderBottom: '1px solid #e5e7eb'}}>
                              <td style={{padding: 12, fontWeight: 700}}>{inv.invoice_number}</td>
                              <td style={{padding:12}}>{inv.analytic_name || '-'}</td>
                              <td style={{padding: 12}}>
                                <div style={{fontWeight:500}}>{inv.user_name || `${inv.first_name || ''} ${inv.last_name || ''}`}</div>
                                <div style={{fontSize:12,color:'#6b7280'}}>{inv.email}</div>
                              </td>
                              <td style={{padding:12}}>{parseFloat(inv.amount).toFixed(2)} €</td>
                              <td style={{padding:12}}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                              <td style={{padding:12}}><StatusBadge status={inv.status} /></td>
                              <td style={{padding:12, textAlign:'center'}}>
                                <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                                  <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" style={{padding:'6px 10px',background:'#3b82f6',color:'#fff',borderRadius:4,textDecoration:'none',display:'inline-block'}}>Voir</a>
                                  <a href={`/api/admin/invoices/${inv.id}/pdf?download=1`} download style={{padding:'6px 10px',background:'#6b7280',color:'#fff',borderRadius:4,textDecoration:'none',display:'inline-block'}}>Télécharger</a>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // Default user view (cards) - keep original behaviour
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
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                      {invoices
                        .filter(inv => {
                          if (!inv.date) return true
                          if (dateFrom && inv.date < dateFrom) return false
                          if (dateTo && inv.date > dateTo) return false
                          return true
                        })
                        .filter(Boolean).map(inv => (
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

function StatusBadge({ status }) {
  const statusConfig = {
    pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
    paid: { bg: '#dcfce7', color: '#166534', label: '✅ Payée' },
    overdue: { bg: '#fee2e2', color: '#991b1b', label: '⚠️ En retard' },
    cancelled: { bg: '#f3f4f6', color: '#374151', label: '❌ Annulée' }
  }
  const config = statusConfig[status] || statusConfig.pending
  return (
    <span style={{background: config.bg, color: config.color, padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600}}>{config.label}</span>
  )
}
