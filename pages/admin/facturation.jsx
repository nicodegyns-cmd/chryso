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
    <div className="admin-layout">
      <AdminHeader />
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main">
          {/* Header Section */}
          <div style={{marginBottom: 32}}>
            <h1 style={{fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8}}>
              💰 Gestion de la Facturation
            </h1>
            <p style={{color: '#6b7280', fontSize: 14}}>
              Gérez vos factures, paiements et relevés de comptes
            </p>
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
