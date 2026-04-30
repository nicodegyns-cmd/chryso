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

  // Manual invoice modal
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false)
  const [manualInvoiceSubmitting, setManualInvoiceSubmitting] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [manualForm, setManualForm] = useState({
    user_id: '',
    analytic_id: '',
    activity_label: '',
    date: new Date().toISOString().split('T')[0],
    garde_hours: '',
    sortie_hours: '',
    overtime_hours: '',
    unit_price: '',
    comments: '',
  })

  async function openManualInvoice() {
    setManualInvoiceOpen(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setAllUsers((data.users || []).filter(u => u.is_active))
    } catch (e) {
      console.error('Failed loading users', e)
    }
  }

  async function submitManualInvoice() {
    if (!manualForm.user_id) return alert('Veuillez sélectionner un utilisateur')
    if (!manualForm.date) return alert('Veuillez saisir la date de la prestation')
    if (!manualForm.unit_price || Number(manualForm.unit_price) <= 0) return alert('Le prix unitaire doit être positif')
    if (!Number(manualForm.garde_hours) && !Number(manualForm.sortie_hours)) return alert('Au moins des heures de garde ou de sortie sont requises')

    setManualInvoiceSubmitting(true)
    try {
      const res = await fetch('/api/admin/manual-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: manualForm.user_id,
          analytic_id: manualForm.analytic_id || null,
          activity_label: manualForm.activity_label,
          date: manualForm.date,
          garde_hours: Number(manualForm.garde_hours) || 0,
          sortie_hours: Number(manualForm.sortie_hours) || 0,
          overtime_hours: Number(manualForm.overtime_hours) || 0,
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
      setManualForm({
        user_id: '', analytic_id: '', activity_label: '',
        date: new Date().toISOString().split('T')[0],
        garde_hours: '', sortie_hours: '', overtime_hours: '',
        unit_price: '', comments: '',
      })
      fetchInvoices()
    } catch (err) {
      alert('❌ Erreur : ' + err.message)
    } finally {
      setManualInvoiceSubmitting(false)
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
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1400}} onClick={() => !manualInvoiceSubmitting && setManualInvoiceOpen(false)}>
          <div style={{background:'#fff',borderRadius:12,width:'95%',maxWidth:560,maxHeight:'95vh',overflow:'auto',padding:32,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h2 style={{margin:0,fontSize:20,fontWeight:700,color:'#111827'}}>✍️ Créer une facture manuelle</h2>
              <button onClick={() => setManualInvoiceOpen(false)} disabled={manualInvoiceSubmitting} style={{border:'none',background:'transparent',fontSize:20,cursor:'pointer',color:'#6b7280'}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* Utilisateur */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>👤 Utilisateur *</label>
                <select
                  value={manualForm.user_id}
                  onChange={e => setManualForm(f => ({...f, user_id: e.target.value}))}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,background:'white'}}
                >
                  <option value="">— Sélectionner un utilisateur —</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.company || `${u.first_name || ''} ${u.last_name || ''}`.trim()} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Analytique */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>📊 Activité / Analytique</label>
                <select
                  value={manualForm.analytic_id}
                  onChange={e => {
                    const aid = e.target.value
                    const sel = analytics.find(a => String(a.id) === String(aid))
                    setManualForm(f => ({...f, analytic_id: aid, activity_label: sel ? sel.name : f.activity_label}))
                  }}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,background:'white'}}
                >
                  <option value="">— Sélectionner une analytique —</option>
                  {analytics.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.code ? `(${a.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Libellé activité */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>📝 Libellé de la prestation</label>
                <input
                  type="text"
                  placeholder="Ex: Garde de nuit, Intervention ambulance..."
                  value={manualForm.activity_label}
                  onChange={e => setManualForm(f => ({...f, activity_label: e.target.value}))}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}}
                />
              </div>

              {/* Date */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>📅 Date de la prestation *</label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={e => setManualForm(f => ({...f, date: e.target.value}))}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}}
                />
              </div>

              {/* Heures */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div>
                  <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>🌙 H. Garde</label>
                  <input type="number" min="0" step="0.5" placeholder="0" value={manualForm.garde_hours}
                    onChange={e => setManualForm(f => ({...f, garde_hours: e.target.value}))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>🚨 H. Sortie</label>
                  <input type="number" min="0" step="0.5" placeholder="0" value={manualForm.sortie_hours}
                    onChange={e => setManualForm(f => ({...f, sortie_hours: e.target.value}))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>⏱️ H. Supp.</label>
                  <input type="number" min="0" step="0.5" placeholder="0" value={manualForm.overtime_hours}
                    onChange={e => setManualForm(f => ({...f, overtime_hours: e.target.value}))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                </div>
              </div>

              {/* Prix unitaire */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>💶 Prix unitaire (€/h) *</label>
                <input
                  type="number" min="0" step="0.01" placeholder="Ex: 25.50"
                  value={manualForm.unit_price}
                  onChange={e => setManualForm(f => ({...f, unit_price: e.target.value}))}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}}
                />
              </div>

              {/* Aperçu montant */}
              {(Number(manualForm.garde_hours) > 0 || Number(manualForm.sortie_hours) > 0 || Number(manualForm.overtime_hours) > 0) && Number(manualForm.unit_price) > 0 && (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'10px 14px',fontSize:13,color:'#166534'}}>
                  💰 Montant estimé :{' '}
                  <strong>
                    {(
                      (Number(manualForm.garde_hours) || 0) * Number(manualForm.unit_price) +
                      (Number(manualForm.sortie_hours) || 0) * Number(manualForm.unit_price) +
                      (Number(manualForm.overtime_hours) || 0) * Number(manualForm.unit_price)
                    ).toFixed(2)} €
                  </strong>
                  {' '}({[
                    Number(manualForm.garde_hours) > 0 && `${manualForm.garde_hours}h garde`,
                    Number(manualForm.sortie_hours) > 0 && `${manualForm.sortie_hours}h sortie`,
                    Number(manualForm.overtime_hours) > 0 && `${manualForm.overtime_hours}h supp.`,
                  ].filter(Boolean).join(' + ')})
                </div>
              )}

              {/* Commentaires */}
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>💬 Commentaires</label>
                <textarea
                  placeholder="Commentaires optionnels..."
                  value={manualForm.comments}
                  onChange={e => setManualForm(f => ({...f, comments: e.target.value}))}
                  rows={2}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,resize:'vertical',boxSizing:'border-box'}}
                />
              </div>

              {/* Actions */}
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,paddingTop:8}}>
                <button
                  onClick={() => setManualInvoiceOpen(false)}
                  disabled={manualInvoiceSubmitting}
                  style={{padding:'10px 20px',background:'#f3f4f6',border:'none',borderRadius:6,cursor:'pointer',fontSize:14,fontWeight:600}}
                >
                  Annuler
                </button>
                <button
                  onClick={submitManualInvoice}
                  disabled={manualInvoiceSubmitting}
                  style={{padding:'10px 24px',background:manualInvoiceSubmitting ? '#9ca3af' : '#7c3aed',color:'white',border:'none',borderRadius:6,cursor:manualInvoiceSubmitting ? 'not-allowed' : 'pointer',fontSize:14,fontWeight:700,boxShadow:'0 2px 6px rgba(124,58,237,0.3)'}}
                >
                  {manualInvoiceSubmitting ? '⏳ Génération en cours...' : '📄 Générer la facture'}
                </button>
              </div>
            </div>
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
