import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function FacturationPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [analyticFilter, setAnalyticFilter] = useState('')
  const [analytics, setAnalytics] = useState([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [recompiling, setRecompiling] = useState(false)

  // Manual invoice modal
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false)
  const [manualInvoiceSubmitting, setManualInvoiceSubmitting] = useState(false)
  const [manualStep, setManualStep] = useState(1)
  const [manualType, setManualType] = useState('garde') // 'garde' | 'simple'
  const [suggestedRate, setSuggestedRate] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [manualUserSearch, setManualUserSearch] = useState('')
  const [selectedManualUser, setSelectedManualUser] = useState(null)
  const [selectedManualAnalytic, setSelectedManualAnalytic] = useState(null)
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    total_duration: '', // durée totale optionnelle (mode garde)
    garde_hours: '',    // saisie libre si pas de durée totale
    sortie_hours: '',
    overtime_hours: '',
    hours_actual: '',   // mode simple
    unit_price: '',
    comments: '',
  })

  async function recompileInvoices() {
    setRecompiling(true)
    try {
      const body = {}
      if (analyticFilter) body.analytic_id = analyticFilter
      if (filterDateFrom) body.date_from = filterDateFrom
      if (filterDateTo) body.date_to = filterDateTo
      const res = await fetch('/api/comptabilite/recompile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Erreur : ' + (err.error || res.statusText))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Compilation_Factures_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erreur lors de la recompilation : ' + e.message)
    } finally {
      setRecompiling(false)
    }
  }

  async function openManualInvoice() {
    setManualInvoiceOpen(true)
    setManualStep(1)
    setManualType('garde')
    setSuggestedRate(null)
    setManualUserSearch('')
    setSelectedManualUser(null)
    setSelectedManualAnalytic(null)
    setManualForm({
      date: new Date().toISOString().split('T')[0],
      total_duration: '', garde_hours: '', sortie_hours: '', overtime_hours: '',
      hours_actual: '', unit_price: '', comments: '',
    })
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setAllUsers((data.users || []).filter(u => u.is_active))
    } catch (e) {
      console.error('Failed loading users', e)
    }
  }

  async function goToStep3() {
    setManualStep(3)
    if (!selectedManualUser?.id) return
    try {
      // Fetch the rate directly from the activity for the selected analytic
      if (selectedManualAnalytic?.id) {
        const rateRes = await fetch(`/api/admin/activity-rate?analytic_id=${selectedManualAnalytic.id}`)
        const rateData = await rateRes.json()
        if (rateData.rate) {
          const isMed = (selectedManualUser.role || '').toUpperCase().includes('MED')
          const rate = isMed
            ? (Number(rateData.rate.remuneration_med) || Number(rateData.rate.remuneration_infi) || null)
            : (Number(rateData.rate.remuneration_infi) || Number(rateData.rate.remuneration_med) || null)
          if (rate) setSuggestedRate(rate)
          const pt = (rateData.rate.pay_type || '').toLowerCase()
          if (pt.includes('simple') || pt.includes('permanence') || pt.includes('astreinte')) setManualType('simple')
          else setManualType('garde')
        }
      }
    } catch(e) { /* ignore */ }
  }

  async function submitManualInvoice() {
    if (!selectedManualUser) return alert('Veuillez sélectionner un utilisateur')
    if (!manualForm.date) return alert('Veuillez saisir la date de la prestation')
    if (!manualForm.unit_price || Number(manualForm.unit_price) <= 0) return alert('Le prix unitaire doit être positif')

    // Calcul des heures selon le type
    let gardeH, sortieH, overtimeH
    if (manualType === 'garde') {
      const totDur = manualForm.total_duration ? Number(manualForm.total_duration) : null
      const sortie = Number(manualForm.sortie_hours) || 0
      const ot = Number(manualForm.overtime_hours) || 0
      if (totDur !== null) {
        if (sortie <= totDur) {
          gardeH = totDur - sortie
          sortieH = sortie
          overtimeH = ot
        } else {
          gardeH = 0
          sortieH = totDur
          overtimeH = (sortie - totDur) + ot
        }
      } else {
        gardeH = Number(manualForm.garde_hours) || 0
        sortieH = sortie
        overtimeH = ot
      }
      if (gardeH + sortieH === 0) return alert('Au moins des heures de garde ou de sortie sont requises')
    } else {
      gardeH = Number(manualForm.hours_actual) || 0
      sortieH = 0
      overtimeH = Number(manualForm.overtime_hours) || 0
      if (gardeH === 0) return alert('Les heures réelles sont requises')
    }

    setManualInvoiceSubmitting(true)
    try {
      const res = await fetch('/api/admin/manual-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedManualUser.id,
          analytic_id: selectedManualAnalytic?.id || null,
          activity_label: selectedManualAnalytic?.name || '',
          date: manualForm.date,
          garde_hours: gardeH,
          sortie_hours: sortieH,
          overtime_hours: overtimeH,
          unit_price: Number(manualForm.unit_price),
          comments: manualForm.comments,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur lors de la génération')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `facture-manuelle-${manualForm.date}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setManualInvoiceOpen(false)
      fetchInvoices()
    } catch (err) {
      alert('❌ Erreur : ' + err.message)
    } finally {
      setManualInvoiceSubmitting(false)
    }
  }

  async function deleteInvoice(id) {
    if (!confirm('Supprimer définitivement cette facture ? Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/admin/prestations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      fetchInvoices()
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  }

  // Fetch invoices on component mount
  useEffect(() => {
    fetchInvoices()
    async function loadAnalytics() {
      try {
        const r = await fetch('/api/analytics')
        if (!r.ok) return
        const d = await r.json()
        setAnalytics(d.items || d || [])
      } catch(e) { /* ignore */ }
    }
    loadAnalytics()
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/invoices')
      if (!res.ok) throw new Error('Erreur lors de la récupération des factures')
      const data = await res.json()
      setInvoices(Array.isArray(data) ? data : data.invoices || [])
    } catch (err) {
      setError(err.message)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = (invoices || []).filter(inv => {
    if (!inv) return false
    if (statusFilter !== 'tous' && inv.status !== statusFilter) return false
    if (analyticFilter && String(inv.analytic_id) !== analyticFilter) return false
    const dateVal = (inv.date || inv.created_at || '').slice(0, 10)
    if (filterDateFrom && dateVal < filterDateFrom) return false
    if (filterDateTo && dateVal > filterDateTo) return false
    const query = (searchQuery || '').toLowerCase()
    if (query) {
      const userName = (inv.user_name || '').toLowerCase()
      const company = (inv.company_name || '').toLowerCase()
      const number = inv.invoice_number != null ? inv.invoice_number.toString() : ''
      const email = (inv.email || '').toLowerCase()
      const analytic = (inv.analytic_name || '').toLowerCase()
      if (!userName.includes(query) && !company.includes(query) && !number.includes(query) && !email.includes(query) && !analytic.includes(query)) return false
    }
    return true
  })

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount)||0) + (parseFloat(inv.expense_amount)||0), 0)
  const stats = {
    total: filteredInvoices.length,
    pending: filteredInvoices.filter(i => ['En attente', "En attente d'envoie", 'pending'].includes(i.status)).length,
    paid: filteredInvoices.filter(i => ['payé', 'Payé', 'paid', 'Validé'].includes(i.status)).length,
    overdue: filteredInvoices.filter(i => i.status === 'Envoyé à la facturation').length
  }

  return (
    <>
    <div className="admin-layout">
      <AdminHeader />
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main">
          {/* Header Section */}
          <div style={{marginBottom: 32, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <h1 style={{fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8}}>
                💰 Gestion de la Facturation
              </h1>
              <p style={{color: '#6b7280', fontSize: 14}}>
                Gérez vos factures, paiements et relevés de comptes
              </p>
            </div>
            <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
              <button
                onClick={recompileInvoices}
                disabled={recompiling}
                title="Télécharger une compilation PDF de toutes les factures déjà générées (statut Facturé)"
                style={{
                  padding: '12px 18px',
                  background: recompiling ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: recompiling ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                  whiteSpace: 'nowrap',
                  marginTop: 4,
                }}
              >
                {recompiling ? '⏳ Compilation...' : '📦 Recompiler PDF'}
              </button>
              <button
                onClick={openManualInvoice}
                style={{
                  padding: '12px 22px',
                  background: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(124,58,237,0.3)',
                  whiteSpace: 'nowrap',
                  marginTop: 4,
                }}
              >
                ✍️ Facture manuelle
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32}}>
            <StatCard 
              label="Factures totales" 
              value={stats.total} 
              icon="📊"
              color="#3b82f6"
            />
            <StatCard 
              label="En attente" 
              value={stats.pending} 
              icon="⏳"
              color="#f59e0b"
            />
            <StatCard 
              label="Payées" 
              value={stats.paid} 
              icon="✅"
              color="#10b981"
            />
            <StatCard 
              label="En retard" 
              value={stats.overdue} 
              icon="⚠️"
              color="#ef4444"
            />
            <StatCard 
              label="Montant total" 
              value={`${totalAmount.toFixed(2)} €`} 
              icon="💵"
              color="#8b5cf6"
            />
          </div>

          {/* Filters Section */}
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16}}>
              {/* Search */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                  🔍 Rechercher
                </label>
                <input 
                  type="text"
                  placeholder="Nom, email, numéro de facture..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                  📋 Statut
                </label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'white'
                  }}
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="Envoyé à la facturation">Envoyé à la facturation</option>
                  <option value="payé">Payée</option>
                  <option value="En attente">En attente</option>
                  <option value="rejeté">Rejetée</option>
                </select>
              </div>

              {/* Analytic Filter */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                  📊 Analytique
                </label>
                <select value={analyticFilter} onChange={e => setAnalyticFilter(e.target.value)} style={{width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: 'white'}}>
                  <option value="">Tous analytiques</option>
                  {analytics.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
                </select>
              </div>
              {/* Date From */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>📅 Du</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14}} />
              </div>
              {/* Date To */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>Au</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14}} />
              </div>
            </div>
          </div>

          {/* Invoices Table */}
          <div style={{
            background: 'white',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
                <div style={{fontSize: 14}}>⏳ Chargement des factures...</div>
              </div>
            ) : error ? (
              <div style={{padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 6, margin: 16}}>
                <strong>❌ Erreur :</strong> {error}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
                <div style={{fontSize: 32, marginBottom: 8}}>📭</div>
                <div style={{fontSize: 14}}>Aucune facture trouvée</div>
              </div>
            ) : (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{background: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>N° Facture</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Analytique</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Client</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Montant</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Date</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Statut</th>
                      <th style={{padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice, idx) => {
                      const inv = invoice || {};
                      const displayInvoiceNumber = inv.invoice_number || '—';
                      const displayName = inv.user_name || ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim() || '—';
                      const amountTotal = (parseFloat(inv.amount)||0) + (parseFloat(inv.expense_amount)||0);
                      const amountDisplay = amountTotal > 0 ? amountTotal.toFixed(2) + ' €' : '—';
                      const createdDate = inv.created_at ? new Date(inv.created_at) : null;
                      const createdDisplay = createdDate && !isNaN(createdDate.getTime()) ? createdDate.toLocaleDateString('fr-FR') : '—';
                      const status = inv.status || '—';

                      return (
                        <tr key={inv.id || idx} style={{borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s'}}>
                          <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>{displayInvoiceNumber}</td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>{inv.analytic_name || '—'}</td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                            <div style={{fontWeight: 500}}>{displayName}</div>
                          </td>
                          <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>{amountDisplay}</td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>{createdDisplay}</td>
                          <td style={{padding: 12, fontSize: 13}}><StatusBadge status={status} /></td>
                          <td style={{padding: 12, textAlign: 'center', fontSize: 12}}>
                            <div style={{display: 'flex', gap: 6, justifyContent: 'center'}}>
                              {inv.pdf_url ? (
                                <>
                                  <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{padding:'6px 10px',background:'#3b82f6',color:'#fff',borderRadius:4,textDecoration:'none',fontSize:11,fontWeight:600}}>Voir</a>
                                  <a href={inv.pdf_url} download style={{padding:'6px 10px',background:'#6b7280',color:'#fff',borderRadius:4,textDecoration:'none',fontSize:11,fontWeight:600}}>Télécharger</a>
                                </>
                              ) : <span style={{color:'#9ca3af',fontSize:11}}>Pas de PDF</span>}
                              <button
                                onClick={() => inv.id && setEditingInvoice(inv.id)}
                                title="Éditer"
                                style={{
                                  padding: '6px 10px',
                                  background: '#8b5cf6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: inv.id ? 'pointer' : 'not-allowed',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => { if (inv.id) e.target.style.background = '#7c3aed' }}
                                onMouseLeave={(e) => { if (inv.id) e.target.style.background = '#8b5cf6' }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => inv.id && deleteInvoice(inv.id)}
                                title="Supprimer"
                                style={{
                                  padding: '6px 10px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: inv.id ? 'pointer' : 'not-allowed',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => { if (inv.id) e.target.style.background = '#dc2626' }}
                                onMouseLeave={(e) => { if (inv.id) e.target.style.background = '#ef4444' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>

      {/* Manual Invoice Modal */}
      {manualInvoiceOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1400}} onClick={() => !manualInvoiceSubmitting && setManualInvoiceOpen(false)}>
          <div style={{background:'#fff',borderRadius:16,width:'95%',maxWidth: manualStep===2 ? 660 : 500,maxHeight:'92vh',overflow:'auto',padding:'28px 32px',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',transition:'max-width 0.2s'}} onClick={e => e.stopPropagation()}>

            {/* Header + progress */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
              <div>
                <h2 style={{margin:0,fontSize:18,fontWeight:700,color:'#111827'}}>✍️ Facture manuelle</h2>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10}}>
                  {[1,2,3].map(s => (
                    <div key={s} style={{height:4,width:36,borderRadius:2,background:manualStep>=s?'#7c3aed':'#e5e7eb',transition:'background 0.2s'}} />
                  ))}
                  <span style={{fontSize:11,color:'#9ca3af',marginLeft:4}}>Étape {manualStep} / 3</span>
                </div>
              </div>
              <button onClick={() => setManualInvoiceOpen(false)} disabled={manualInvoiceSubmitting} style={{border:'none',background:'#f3f4f6',borderRadius:8,width:32,height:32,fontSize:15,cursor:'pointer',color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
            </div>

            {/* ── ÉTAPE 1 : Prestataire ── */}
            {manualStep === 1 && (
              <div>
                <p style={{fontSize:13,color:'#6b7280',margin:'0 0 16px'}}>👤 <strong>Qui facture-t-on ?</strong> Recherchez le prestataire.</p>
                <input
                  type="text"
                  placeholder="Nom, prénom ou email..."
                  value={manualUserSearch}
                  onChange={e => setManualUserSearch(e.target.value)}
                  autoFocus
                  style={{width:'100%',padding:'12px 14px',border:'2px solid #e5e7eb',borderRadius:10,fontSize:14,boxSizing:'border-box',outline:'none'}}
                />
                {!selectedManualUser && manualUserSearch.length >= 1 && (
                  <div style={{marginTop:6,border:'1px solid #e5e7eb',borderRadius:10,overflow:'hidden',boxShadow:'0 4px 12px rgba(0,0,0,0.08)',maxHeight:260,overflowY:'auto'}}>
                    {allUsers
                      .filter(u => `${u.first_name||''} ${u.last_name||''} ${u.email||''} ${u.company||''}`.toLowerCase().includes(manualUserSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(u => (
                        <button key={u.id}
                          onClick={() => { setSelectedManualUser(u); setManualUserSearch('') }}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 16px',border:'none',background:'none',cursor:'pointer',borderBottom:'1px solid #f3f4f6',textAlign:'left'}}
                          onMouseEnter={e => e.currentTarget.style.background='#f5f3ff'}
                          onMouseLeave={e => e.currentTarget.style.background='none'}
                        >
                          <div style={{width:34,height:34,borderRadius:'50%',background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#7c3aed',flexShrink:0}}>
                            {(u.first_name||u.company||u.email||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{fontWeight:600,fontSize:14,color:'#1f2937'}}>{u.company || `${u.first_name||''} ${u.last_name||''}`.trim() || u.email}</div>
                            <div style={{fontSize:12,color:'#9ca3af'}}>{u.email}</div>
                          </div>
                        </button>
                      ))
                    }
                  </div>
                )}
                {selectedManualUser && (
                  <div style={{marginTop:12,padding:'14px 16px',background:'#f5f3ff',border:'2px solid #7c3aed',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:38,height:38,borderRadius:'50%',background:'#7c3aed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>
                        {(selectedManualUser.first_name||selectedManualUser.company||selectedManualUser.email||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:'#1f2937'}}>{selectedManualUser.company || `${selectedManualUser.first_name||''} ${selectedManualUser.last_name||''}`.trim()}</div>
                        <div style={{fontSize:12,color:'#6b7280'}}>{selectedManualUser.email}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedManualUser(null)} style={{border:'none',background:'#fee2e2',color:'#991b1b',borderRadius:6,padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Changer</button>
                  </div>
                )}
                <div style={{marginTop:24,display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={() => setManualStep(2)} disabled={!selectedManualUser}
                    style={{padding:'11px 28px',background:selectedManualUser?'#7c3aed':'#e5e7eb',color:selectedManualUser?'white':'#9ca3af',border:'none',borderRadius:8,cursor:selectedManualUser?'pointer':'not-allowed',fontSize:14,fontWeight:700}}>
                    Suivant →
                  </button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 2 : Analytique ── */}
            {manualStep === 2 && (
              <div>
                <button onClick={() => setManualStep(1)} style={{border:'none',background:'none',color:'#7c3aed',cursor:'pointer',fontSize:13,fontWeight:600,padding:0,marginBottom:14}}>← Retour</button>
                <p style={{fontSize:13,color:'#6b7280',margin:'0 0 14px'}}>📊 <strong>Quelle activité ?</strong> Sélectionnez une analytique ou passez.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,maxHeight:320,overflowY:'auto',paddingRight:4}}>
                  {analytics.filter(a => a.is_active !== false).map(a => {
                    const isSel = selectedManualAnalytic?.id === a.id
                    return (
                      <div key={a.id}
                        onClick={() => setSelectedManualAnalytic(isSel ? null : a)}
                        style={{padding:'12px 14px',border:`2px solid ${isSel?'#7c3aed':'#e5e7eb'}`,borderRadius:10,cursor:'pointer',background:isSel?'#f5f3ff':'white',transition:'all 0.15s',boxShadow:isSel?'0 0 0 3px #ede9fe':'none'}}
                        onMouseEnter={e => { if(!isSel){e.currentTarget.style.borderColor='#c4b5fd'} }}
                        onMouseLeave={e => { if(!isSel){e.currentTarget.style.borderColor='#e5e7eb'} }}
                      >
                        <div style={{fontSize:10,fontWeight:700,color:isSel?'#7c3aed':'#9ca3af',marginBottom:4,letterSpacing:'0.05em'}}>{a.code||'—'}</div>
                        <div style={{fontSize:13,fontWeight:700,color:isSel?'#5b21b6':'#1f2937',lineHeight:1.3}}>{a.name}</div>
                        {a.analytic && <div style={{fontSize:11,color:'#6b7280',marginTop:3}}>{a.analytic}</div>}
                      </div>
                    )
                  })}
                </div>
                <div style={{marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <button onClick={() => { setSelectedManualAnalytic(null); goToStep3() }} style={{border:'none',background:'none',color:'#9ca3af',cursor:'pointer',fontSize:13}}>Passer cette étape</button>
                  <button onClick={() => goToStep3()} style={{padding:'11px 28px',background:'#7c3aed',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:700}}>Suivant →</button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 3 : Héures + Tarif ── */}
            {manualStep === 3 && (() => {
              // Compute hours for live preview
              const totDur = manualForm.total_duration ? Number(manualForm.total_duration) : null
              const sortieVal = manualForm.sortie_hours !== '' ? Number(manualForm.sortie_hours) : null
              const simpleVal = manualForm.hours_actual !== '' ? Number(manualForm.hours_actual) : null
              const price = Number(manualForm.unit_price) || 0

              let previewGardeH = 0, previewSortieH = 0, previewOtH = Number(manualForm.overtime_hours)||0
              if (manualType === 'garde') {
                if (totDur !== null && sortieVal !== null) {
                  if (sortieVal <= totDur) { previewGardeH = totDur - sortieVal; previewSortieH = sortieVal }
                  else { previewGardeH = 0; previewSortieH = totDur; previewOtH += sortieVal - totDur }
                } else {
                  previewGardeH = Number(manualForm.garde_hours)||0
                  previewSortieH = sortieVal || 0
                }
              } else {
                previewGardeH = simpleVal || 0
              }
              const totalH = previewGardeH + previewSortieH + previewOtH
              const totalEur = totalH * price

              return (
              <div>
                <button onClick={() => setManualStep(2)} style={{border:'none',background:'none',color:'#7c3aed',cursor:'pointer',fontSize:13,fontWeight:600,padding:0,marginBottom:14}}>← Retour</button>

                {/* Summary chips */}
                <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
                  <div style={{padding:'5px 12px',background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:20,fontSize:12,fontWeight:600,color:'#5b21b6'}}>
                    👤 {selectedManualUser?.company || `${selectedManualUser?.first_name||''} ${selectedManualUser?.last_name||''}`.trim()}
                  </div>
                  {selectedManualAnalytic && (
                    <div style={{padding:'5px 12px',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:20,fontSize:12,fontWeight:600,color:'#1d4ed8'}}>
                      📊 {selectedManualAnalytic.name}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:6,letterSpacing:'0.06em'}}>📅 DATE DE LA PRESTATION *</label>
                  <input type="date" value={manualForm.date} onChange={e => setManualForm(f=>({...f,date:e.target.value}))}
                    style={{width:'100%',padding:'11px 14px',border:'2px solid #e5e7eb',borderRadius:8,fontSize:14,boxSizing:'border-box'}} />
                </div>

                {/* Hours section - identical to ManualHourEntry modal */}
                <div style={{marginBottom:16,padding:14,border:'1px solid #e5e7eb',borderRadius:10,background:'#f9fafb'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#1f2937'}}>📊 Heures de travail</div>
                    {/* Type toggle */}
                    <div style={{display:'flex',gap:4,background:'#e5e7eb',borderRadius:8,padding:3}}>
                      {[['garde','🌙 Garde'],['simple','⏱️ Simple']].map(([t,label]) => (
                        <button key={t} onClick={() => setManualType(t)}
                          style={{padding:'5px 14px',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,transition:'all 0.15s',
                            background:manualType===t?'white':'transparent',
                            color:manualType===t?'#7c3aed':'#6b7280',
                            boxShadow:manualType===t?'0 1px 3px rgba(0,0,0,0.12)':'none'
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  {manualType === 'garde' ? (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {/* Total duration (optional reference) */}
                      <div style={{padding:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8}}>
                        <div style={{fontSize:12,color:'#1d4ed8',fontWeight:600,marginBottom:6}}>DURÉE TOTALE (réf.)</div>
                        <input type="number" step="0.25" min="0" placeholder="0"
                          value={manualForm.total_duration}
                          onChange={e => setManualForm(f=>({...f,total_duration:e.target.value}))}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #bfdbfe',borderRadius:6,fontSize:14,fontWeight:700,background:'white',boxSizing:'border-box'}} />
                        {manualForm.total_duration && <div style={{fontSize:11,color:'#1d4ed8',marginTop:4}}>Durée de référence</div>}
                      </div>

                      {/* Sortie hours */}
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                        <input type="number" step="0.25" min="0" placeholder="0"
                          value={manualForm.sortie_hours}
                          onChange={e => setManualForm(f=>({...f,sortie_hours:e.target.value}))}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                      </div>

                      {/* Auto-calc garde if total_duration set */}
                      {totDur !== null && sortieVal !== null ? (
                        sortieVal <= totDur ? (
                          <div style={{padding:10,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8}}>
                            <div style={{fontSize:12,color:'#15803d',fontWeight:600,marginBottom:4}}>🧮 HEURES GARDE (calculées)</div>
                            <div style={{fontSize:18,fontWeight:700,color:'#15803d'}}>{(totDur - sortieVal).toFixed(2)}h</div>
                            <div style={{fontSize:11,color:'#15803d'}}>{totDur}h − {sortieVal}h sortie</div>
                          </div>
                        ) : (
                          <div style={{padding:10,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8}}>
                            <div style={{fontSize:12,color:'#c2410c',fontWeight:600}}>⚠️ H. SUP AUTO</div>
                            <div style={{fontSize:13,color:'#c2410c'}}>Sortie : {totDur.toFixed(2)}h capée</div>
                            <div style={{fontSize:15,fontWeight:700,color:'#f97316'}}>+{(sortieVal - totDur).toFixed(2)}h supp.</div>
                          </div>
                        )
                      ) : (
                        /* Manual garde input when no total_duration */
                        <div>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>🌙 HEURES GARDE</div>
                          <input type="number" step="0.25" min="0" placeholder="0"
                            value={manualForm.garde_hours}
                            onChange={e => setManualForm(f=>({...f,garde_hours:e.target.value}))}
                            style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                        </div>
                      )}

                      {/* Overtime */}
                      <div>
                        <div style={{fontSize:12,color:'#f97316',fontWeight:600,marginBottom:6}}>HEURES SUPP. (manuel)</div>
                        <input type="number" step="0.25" min="0" placeholder="0"
                          value={manualForm.overtime_hours}
                          onChange={e => setManualForm(f=>({...f,overtime_hours:e.target.value}))}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #fed7aa',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                      </div>
                    </div>
                  ) : (
                    /* Simple mode */
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES RÉELLES</div>
                        <input type="number" step="0.25" min="0" placeholder="0"
                          value={manualForm.hours_actual}
                          onChange={e => setManualForm(f=>({...f,hours_actual:e.target.value}))}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                      </div>
                      <div>
                        <div style={{fontSize:12,color:'#f97316',fontWeight:600,marginBottom:6}}>HEURES SUPP.</div>
                        <input type="number" step="0.25" min="0" placeholder="0"
                          value={manualForm.overtime_hours}
                          onChange={e => setManualForm(f=>({...f,overtime_hours:e.target.value}))}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #fed7aa',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Unit price */}
                <div style={{marginBottom:suggestedRate?8:16}}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:6,letterSpacing:'0.06em'}}>💶 PRIX / HEURE (€) *</label>
                  <input type="number" min="0" step="0.01" placeholder="Ex : 25.50"
                    value={manualForm.unit_price}
                    onChange={e => setManualForm(f=>({...f,unit_price:e.target.value}))}
                    style={{width:'100%',padding:'11px 14px',border:'2px solid #e5e7eb',borderRadius:8,fontSize:14,boxSizing:'border-box'}} />
                </div>
                {suggestedRate && !manualForm.unit_price && (
                  <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8}}>
                    <span style={{fontSize:12,color:'#92400e'}}>💡 Taux de l'activité : <strong>{suggestedRate} €/h</strong></span>
                    <button onClick={() => setManualForm(f=>({...f,unit_price:String(suggestedRate)}))} style={{fontSize:11,padding:'3px 10px',background:'#f59e0b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700}}>Utiliser</button>
                  </div>
                )}

                {/* Live total */}
                {totalH > 0 && price > 0 && (
                  <div style={{marginBottom:16,padding:'10px 14px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:13,color:'#15803d'}}>Total estimé</span>
                      <strong style={{fontSize:20,color:'#15803d'}}>{totalEur.toFixed(2)} €</strong>
                    </div>
                    {manualType === 'garde' ? (
                      <div style={{fontSize:11,color:'#15803d',marginTop:4,display:'flex',gap:8,flexWrap:'wrap'}}>
                        {previewGardeH>0 && <span>{previewGardeH.toFixed(2)}h garde</span>}
                        {previewSortieH>0 && <span>+ {previewSortieH.toFixed(2)}h sortie</span>}
                        {previewOtH>0 && <span>+ {previewOtH.toFixed(2)}h supp.</span>}
                        <span>× {price} €/h</span>
                      </div>
                    ) : (
                      <div style={{fontSize:11,color:'#15803d',marginTop:4}}>{previewGardeH.toFixed(2)}h réelles{previewOtH>0?` + ${previewOtH.toFixed(2)}h supp.`:''} × {price} €/h</div>
                    )}
                  </div>
                )}

                {/* Comments */}
                <div style={{marginBottom:20}}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:6,letterSpacing:'0.06em'}}>💬 NOTE (optionnel)</label>
                  <textarea placeholder="Commentaire interne..." value={manualForm.comments} onChange={e=>setManualForm(f=>({...f,comments:e.target.value}))} rows={2}
                    style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}} />
                </div>

                <button onClick={submitManualInvoice} disabled={manualInvoiceSubmitting}
                  style={{width:'100%',padding:'13px',background:manualInvoiceSubmitting?'#9ca3af':'#7c3aed',color:'white',border:'none',borderRadius:10,cursor:manualInvoiceSubmitting?'not-allowed':'pointer',fontSize:15,fontWeight:700,boxShadow:'0 4px 12px rgba(124,58,237,0.3)'}}>
                  {manualInvoiceSubmitting ? '⏳ Génération en cours...' : '📄 Générer la facture PDF'}
                </button>
              </div>
              )
            })()}

          </div>
        </div>
      )}
    </>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}20`,
      borderRadius: 8,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{fontSize: 24, marginBottom: 8}}>{icon}</div>
      <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6}}>{label}</div>
      <div style={{fontSize: 20, fontWeight: 700, color}}>
        {value}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const statusConfig = {
    'Envoyé à la facturation': { bg: '#dbeafe', color: '#1e40af', label: '📤 Envoyé à la facturation' },
    "En attente d'envoie": { bg: '#fef3c7', color: '#92400e', label: "⏳ En attente d'envoi" },
    'En attente': { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
    'payé': { bg: '#dcfce7', color: '#166534', label: '✅ Payée' },
    'Payé': { bg: '#dcfce7', color: '#166534', label: '✅ Payée' },
    'rejeté': { bg: '#fee2e2', color: '#991b1b', label: '❌ Rejetée' },
    'Rejeté': { bg: '#fee2e2', color: '#991b1b', label: '❌ Rejetée' },
    'Validé': { bg: '#dcfce7', color: '#166534', label: '✅ Validé' },
    'pending': { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
    'paid': { bg: '#dcfce7', color: '#166534', label: '✅ Payée' },
  }
  const config = statusConfig[status] || { bg: '#f3f4f6', color: '#374151', label: status || '—' }
  return (
    <span style={{background: config.bg, color: config.color, padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'}}>
      {config.label}
    </span>
  )
}
