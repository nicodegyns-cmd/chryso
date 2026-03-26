import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function FacturationPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [selectedPeriod, setSelectedPeriod] = useState('month') // month, quarter, year
  const [editingInvoice, setEditingInvoice] = useState(null)

  // Fetch invoices on component mount
  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, selectedPeriod])

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'tous') params.append('status', statusFilter)
      params.append('period', selectedPeriod)
      
      const res = await fetch(`/api/admin/invoices?${params.toString()}`)
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
    const query = (searchQuery || '').toLowerCase()
    const userName = (inv.user_name || '').toString().toLowerCase()
    const company = (inv.company_name || '').toString().toLowerCase()
    const number = inv.invoice_number != null ? inv.invoice_number.toString() : ''
    const email = (inv.email || '').toString().toLowerCase()

    return (
      userName.includes(query) ||
      company.includes(query) ||
      number.includes(query) ||
      email.includes(query)
    )
  })

  function normalizeStatus(s) {
    if (!s && s !== '') return 'pending'
    const v = (s || '').toString().toLowerCase().trim()
    if (v === 'retrd' || v === 'retard' || v === 'en retard') return 'overdue'
    if (v === 'payee' || v === 'payée' || v === 'paid') return 'paid'
    if (v === 'annule' || v === 'annulée' || v === 'cancelled') return 'cancelled'
    if (v === 'pending' || v === 'en attente' || v === '') return 'pending'
    return v
  }

  const normalizedInvoices = (filteredInvoices || []).map(i => ({ ...i, status: normalizeStatus(i && i.status) }))

  const totalAmount = normalizedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
  const stats = {
    total: normalizedInvoices.length,
    pending: normalizedInvoices.filter(i => i.status === 'pending').length,
    paid: normalizedInvoices.filter(i => i.status === 'paid').length,
    overdue: normalizedInvoices.filter(i => i.status === 'overdue').length
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
                  <option value="pending">En attente</option>
                  <option value="paid">Payée</option>
                  <option value="overdue">En retard</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>

              {/* Period Filter */}
              <div>
                <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                  📅 Période
                </label>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'white'
                  }}
                >
                  <option value="month">Ce mois</option>
                  <option value="quarter">Ce trimestre</option>
                  <option value="year">Cette année</option>
                  <option value="all">Toutes les périodes</option>
                </select>
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
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Client</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Montant</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Date</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Échéance</th>
                      <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Statut</th>
                      <th style={{padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice, idx) => {
                      const inv = invoice || {};
                      const displayInvoiceNumber = inv.invoice_number || '—';
                      const displayName = inv.user_name || ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim() || '—';
                      const displayEmail = inv.email || '—';
                      const amountNum = typeof inv.amount !== 'undefined' && inv.amount !== null ? parseFloat(inv.amount) : NaN;
                      const amountDisplay = !isNaN(amountNum) ? amountNum.toFixed(2) + ' €' : '—';

                      const createdDate = inv.created_at ? new Date(inv.created_at) : null;
                      const createdDisplay = createdDate && !isNaN(createdDate.getTime()) ? createdDate.toLocaleDateString('fr-FR') : '—';

                      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
                      const dueDisplay = dueDate && !isNaN(dueDate.getTime()) ? dueDate.toLocaleDateString('fr-FR') : '—';

                      const status = inv.status || 'pending';

                      return (
                        <tr key={inv.id || idx} style={{borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s'}}>
                          <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                            {displayInvoiceNumber}
                          </td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                            <div style={{fontWeight: 500}}>{displayName}</div>
                            <div style={{fontSize: 12, color: '#6b7280'}}>{displayEmail}</div>
                          </td>
                          <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                            {amountDisplay}
                          </td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                            {createdDisplay}
                          </td>
                          <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                            {dueDisplay}
                          </td>
                          <td style={{padding: 12, fontSize: 13}}>
                            <StatusBadge status={status} />
                          </td>
                          <td style={{padding: 12, textAlign: 'center', fontSize: 12}}>
                            <div style={{display: 'flex', gap: 6, justifyContent: 'center'}}>
                              <button
                                onClick={() => inv.id && window.open(`/api/admin/invoices/${inv.id}/pdf`, '_blank')}
                                title="Télécharger PDF"
                                style={{
                                  padding: '6px 10px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: inv.id ? 'pointer' : 'not-allowed',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => { if (inv.id) e.target.style.background = '#2563eb' }}
                                onMouseLeave={(e) => { if (inv.id) e.target.style.background = '#3b82f6' }}
                              >
                                📥
                              </button>
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
    pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
    paid: { bg: '#dcfce7', color: '#166534', label: '✅ Payée' },
    overdue: { bg: '#fee2e2', color: '#991b1b', label: '⚠️ En retard' },
    cancelled: { bg: '#f3f4f6', color: '#374151', label: '❌ Annulée' }
  }
  
  const config = statusConfig[status] || statusConfig.pending
  
  return (
    <span style={{
      background: config.bg,
      color: config.color,
      padding: '4px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      {config.label}
    </span>
  )
}
