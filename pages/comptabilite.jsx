import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import adminStyles from './admin/rib-validation.module.css'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function ComptabilitePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [analyticFilter, setAnalyticFilter] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [analytics, setAnalytics] = useState([])
  
  const [ribPendingCount, setRibPendingCount] = useState(0)
  const [fichePendingCount, setFichePendingCount] = useState(0)
  const [ribModalOpen, setRibModalOpen] = useState(false)
  const [ribDocuments, setRibDocuments] = useState([])
  const [ficheModalOpen, setFicheModalOpen] = useState(false)
  const [ficheUsers, setFicheUsers] = useState([])
  const [ficheViewerOpen, setFicheViewerOpen] = useState(false)
  const [selectedFiche, setSelectedFiche] = useState(null)
  const [confirmEncodeOpen, setConfirmEncodeOpen] = useState(false)
  const [confirmDoc, setConfirmDoc] = useState(null)
  
  const [correctionWizardOpen, setCorrectionWizardOpen] = useState(false)
  const [correctionStep, setCorrectionStep] = useState(1)
  const [correctionAllPrestations, setCorrectionAllPrestations] = useState([])
  const [correctionLoadingData, setCorrectionLoadingData] = useState(false)
  const [correctionSelectedUserId, setCorrectionSelectedUserId] = useState('')
  const [correctionSelectedInvoice, setCorrectionSelectedInvoice] = useState('')
  const [correctionSelectedPrestation, setCorrectionSelectedPrestation] = useState(null)
  const [correctionAmount, setCorrectionAmount] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false)
  const [avoirsModalOpen, setAvoirsModalOpen] = useState(false)
  const [avoirs, setAvoirs] = useState([])
  const [avoirsLoading, setAvoirsLoading] = useState(false)

  const userRole = useLocalStorage('role', null)
  const userEmail = useLocalStorage('email', '')

  // Check user status: onboarding > pending validation > full access
  useEffect(() => {
    if (!userEmail) return
    
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === userEmail.toLowerCase())
        
        if (!me) return
        
        const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
        if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
          router.push('/profile')
        }
        else if (!me.is_active) {
          router.push('/account-pending')
        }
      } catch (err) {
        console.error('Failed to check user status', err)
      }
    }
    
    checkStatus()
  }, [userEmail, router])

  // Redirect non-comptabilité users
  useEffect(() => {
    if (userRole === null) {
      console.log('[comptabilite.jsx] waiting for role to initialize')
      return
    }
    console.log('[comptabilite.jsx] guard check - role is:', userRole)
    if (userRole !== 'comptabilite') {
      console.log('[comptabilite.jsx] redirecting to /dashboard - user is not comptabilite')
      router.push('/dashboard')
    } else {
      console.log('[comptabilite.jsx] role is comptabilite, allowing access')
    }
  }, [userRole, router])

  // Load invoices
  useEffect(() => {
    fetchInvoices()
  }, [])

  // Load analytics for filter
  useEffect(() => {
    let cancelled = false
    async function loadAnalytics() {
      try {
        const r = await fetch('/api/analytics')
        if (!r.ok) return
        const d = await r.json()
        if (cancelled) return
        setAnalytics(d.items || d || [])
      } catch (e) { /* ignore */ }
    }
    loadAnalytics()
    return () => { cancelled = true }
  }, [])

  // Fetch approved RIB documents count
  useEffect(() => {
    let mounted = true
    async function fetchApprovedDocs() {
      try {
        const res = await fetch('/api/admin/documents/approved')
        if (!res.ok) throw new Error('Erreur récupération documents')
        const data = await res.json()
        const docs = data.documents || []
        const ribDocs = docs.filter(d => {
          const t = (d.type || '').toString().toLowerCase()
          const n = (d.name || '').toString().toLowerCase()
          return t.includes('rib') || n.includes('rib')
        })
        if (mounted) setRibPendingCount(ribDocs.length)
      } catch (err) {
        console.warn('Failed loading approved docs', err.message)
      }
    }
    fetchApprovedDocs()
    return () => { mounted = false }
  }, [])

  // Fetch active users count for fiche counter
  useEffect(() => {
    let mounted = true
    async function fetchActiveCount() {
      try {
        const res = await fetch('/api/admin/users/active')
        if (!res.ok) return
        const data = await res.json()
        if (mounted) setFichePendingCount((data.items || []).length)
      } catch (err) {
        console.warn('Failed loading active users count', err.message)
      }
    }
    fetchActiveCount()
    return () => { mounted = false }
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/invoices')
      if (!res.ok) throw new Error('Échec récupération factures')
      const data = await res.json()
      
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
    } catch (err) {
      setError(err.message)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  async function openRibModal() {
    setRibModalOpen(true)
    try {
      const res = await fetch('/api/admin/documents/approved')
      if (!res.ok) throw new Error('Erreur récupération documents')
      const data = await res.json()
      const docs = data.documents || []
      const ribDocs = docs.filter(d => {
        const t = (d.type || '').toString().toLowerCase()
        const n = (d.name || '').toString().toLowerCase()
        return t.includes('rib') || n.includes('rib')
      })
      setRibDocuments(ribDocs)
    } catch (e) {
      console.error('Failed loading RIB docs', e.message)
      setRibDocuments([])
    }
  }

  async function markAsEncoded(documentId) {
    try {
      const res = await fetch('/api/admin/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, status: 'encoded' })
      })
      if (!res.ok) throw new Error('Failed to mark encoded')
      setRibDocuments(prev => prev.filter(d => d.id !== documentId))
      setRibPendingCount(c => Math.max(0, c - 1))
    } catch (e) {
      console.error('Encode failed', e.message)
      alert('Erreur lors de l\'encodage')
    }
  }

  async function openFicheModal() {
    setFicheModalOpen(true)
    try {
      const res = await fetch('/api/admin/users/active')
      if (!res.ok) throw new Error('Erreur récupération fiches')
      const data = await res.json()
      const items = data.items || []
      setFicheUsers(items)
      setFichePendingCount(items.length)
    } catch (e) {
      console.error('Failed loading fiches', e.message)
      setFicheUsers([])
    }
  }

  async function openAvoirsModal() {
    setAvoirsModalOpen(true)
    setAvoirsLoading(true)
    try {
      const res = await fetch('/api/comptabilite/avoirs')
      const data = await res.json()
      setAvoirs(data.avoirs || [])
    } catch (e) {
      console.error('Erreur chargement avoirs:', e.message)
      setAvoirs([])
    } finally {
      setAvoirsLoading(false)
    }
  }

  async function openCorrectionWizard() {
    setCorrectionWizardOpen(true)
    setCorrectionStep(1)
    setCorrectionSelectedUserId('')
    setCorrectionSelectedInvoice('')
    setCorrectionSelectedPrestation(null)
    setCorrectionAmount('')
    setCorrectionReason('')
    setCorrectionLoadingData(true)
    try {
      const res = await fetch('/api/comptabilite/prestations?status=all')
      const data = await res.json()
      const all = (Array.isArray(data) ? data : data.prestations || []).filter(p =>
        p && (p.status === 'Facturé' || p.status === 'Payé')
      )
      setCorrectionAllPrestations(all)
    } catch (e) {
      console.error('Erreur chargement prestations correction:', e.message)
      setCorrectionAllPrestations([])
    } finally {
      setCorrectionLoadingData(false)
    }
  }

  function resetCorrectionWizard() {
    setCorrectionWizardOpen(false)
    setCorrectionStep(1)
    setCorrectionAllPrestations([])
    setCorrectionSelectedUserId('')
    setCorrectionSelectedInvoice('')
    setCorrectionSelectedPrestation(null)
    setCorrectionAmount('')
    setCorrectionReason('')
  }

  async function submitCorrectionAvoir() {
    if (!correctionSelectedPrestation) return
    if (!correctionAmount || Number(correctionAmount) <= 0) { alert('Montant invalide'); return }
    if (!correctionReason.trim()) { alert('La raison est obligatoire'); return }
    setCorrectionSubmitting(true)
    try {
      const res = await fetch('/api/comptabilite/create-avoir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_id: correctionSelectedPrestation.id, amount: Number(correctionAmount), reason: correctionReason })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      alert(`✅ ${data.message}`)
      resetCorrectionWizard()
    } catch (e) {
      alert('❌ Erreur : ' + e.message)
    } finally {
      setCorrectionSubmitting(false)
    }
  }

  // Filter invoices
  const filteredInvoices = (invoices || []).filter(Boolean).filter(inv => {
    if (statusFilter !== 'tous' && inv.status !== statusFilter) return false
    if (analyticFilter && String(inv.analytic_id) !== analyticFilter) return false
    if (filterDateFrom && (inv.date || inv.created_at || '').slice(0, 10) < filterDateFrom) return false
    if (filterDateTo && (inv.date || inv.created_at || '').slice(0, 10) > filterDateTo) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const name = `${inv.first_name || ''} ${inv.last_name || ""}`.toLowerCase()
      if (!name.includes(q) && !(inv.invoice_number || '').toLowerCase().includes(q) && !(inv.analytic_name || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Stats
  const totalInvoices = (invoices || []).length
  const totalAmount = (invoices || []).reduce((sum, inv) => {
    const a = parseFloat(inv.amount) || 0
    const e = parseFloat(inv.expense_amount) || 0
    return sum + a + e
  }, 0)

  if (userRole && userRole !== 'comptabilite') {
    return null
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            💰 Gestion Comptabilité
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Tableau de bord comptabilité - Toutes les factures
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700 }}>🧾 Total Factures</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{totalInvoices}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Montant total: {totalAmount.toFixed(2)} €</div>
          </div>

          <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700 }}>📊 Factures filtrées</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{filteredInvoices.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Montant: {filteredInvoices.reduce((s,i)=>{const a=parseFloat(i.amount)||0;const e=parseFloat(i.expense_amount)||0;return s+a+e},0).toFixed(2)} €</div>
          </div>

          <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700 }}>🏦 RIB en attente</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer' }} onClick={openRibModal}>{ribPendingCount}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Documents RIB soumis</div>
          </div>

          <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700 }}>📋 Fiches renseignement</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer' }} onClick={openFicheModal}>{fichePendingCount}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Prestataires validés</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 8, padding: 20, marginBottom: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Search */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>🔍 Rechercher</label>
              <input
                type="text"
                placeholder="N° facture, nom, analytique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>📋 Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: 'white' }}
              >
                <option value="tous">Tous statuts</option>
                <option value="Envoyé à la facturation">À facturer</option>
                <option value="payé">Payée</option>
                <option value="En attente">En attente</option>
                <option value="rejeté">Rejetée</option>
              </select>
            </div>

            {/* Analytic Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>📊 Analytique</label>
              <select
                value={analyticFilter}
                onChange={(e) => setAnalyticFilter(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: 'white' }}
              >
                <option value="">Tous analytiques</option>
                {analytics.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>📅 Du</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>

            {/* Date To */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Au</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                    title="Effacer les dates"
                    style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f3f4f6', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Reset Button */}
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('tous'); setAnalyticFilter(''); setFilterDateFrom(''); setFilterDateTo('') }}
                style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: '#e5e7eb', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', width: '100%' }}
              >
                🔄 Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          <button
            onClick={openAvoirsModal}
            style={{
              padding: '11px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 6px rgba(107,114,128,0.3)'
            }}
          >
            📋 Historique avoirs
          </button>
          <button
            onClick={openCorrectionWizard}
            style={{
              padding: '11px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 6px rgba(245,158,11,0.3)'
            }}
          >
            ⚠️ Correction facture
          </button>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8 }}>
            <div style={{ fontSize: 14 }}>⏳ Chargement des factures...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 6 }}>
            <strong>❌ Erreur :</strong> {error}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 14 }}>Aucune facture trouvée</div>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>N° Facture</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Analytique</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Client</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Montant</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Date</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Statut</th>
                    <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => (
                    <tr key={inv.id || idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 12, fontWeight: 700, color: '#1f2937' }}>{inv.invoice_number || '-'}</td>
                      <td style={{ padding: 12, fontSize: 13, color: '#374151' }}>{inv.analytic_name || '-'}</td>
                      <td style={{ padding: 12, fontSize: 13 }}>
                        <div style={{ fontWeight: 500, color: '#1f2937' }}>{inv.user_name || `${inv.first_name || ''} ${inv.last_name || ''}`}</div>
                      </td>
                      <td style={{ padding: 12, fontWeight: 600, color: '#1f2937' }}>
                        {(() => {
                          const a = parseFloat(inv.amount) || 0
                          const e = parseFloat(inv.expense_amount) || 0
                          const total = a + e
                          return total > 0 ? total.toFixed(2) + ' €' : '-'
                        })()}
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: '#374151' }}>
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td style={{ padding: 12, fontSize: 13 }}>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <a
                            href={inv.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '6px 10px', background: '#3b82f6', color: '#fff', borderRadius: 4,
                              textDecoration: 'none', display: 'inline-block', fontSize: 12, fontWeight: 600
                            }}
                          >
                            👁️ Voir
                          </a>
                          <a
                            href={inv.pdf_url}
                            download
                            style={{
                              padding: '6px 10px', background: '#6b7280', color: '#fff', borderRadius: 4,
                              textDecoration: 'none', display: 'inline-block', fontSize: 12, fontWeight: 600
                            }}
                          >
                            ⬇️ Télécharger
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* RIB Modal */}
      {ribModalOpen && (
        <div className={adminStyles['validation-panel']}>
          <div className={adminStyles['panel-header']}>
            <h2>🏦 Documents RIB en attente d'encodage</h2>
            <button className={adminStyles['close-btn']} onClick={() => setRibModalOpen(false)}>✕</button>
          </div>
          <div className={adminStyles['panel-content']}>
            {ribDocuments.length === 0 ? (
              <div style={{padding:20,textAlign:'center',color:'#6b7280'}}>📭 Aucun document RIB en attente</div>
            ) : (
              ribDocuments.map(doc => (
                <div key={doc.id} style={{padding:16,borderBottom:'1px solid #e5e7eb'}}>
                  <div style={{fontWeight:600,marginBottom:8}}>{doc.user_name}</div>
                  <div style={{fontSize:13,color:'#6b7280',marginBottom:8}}>{doc.name}</div>
                  <div style={{display:'flex',gap:8}}>
                    <a href={doc.file_path} target="_blank" rel="noreferrer" style={{padding:'6px 12px',background:'#3b82f6',color:'#fff',borderRadius:4,textDecoration:'none',fontSize:12}}>Voir</a>
                    <button onClick={() => markAsEncoded(doc.id)} style={{padding:'6px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:12}}>✅ Marquer comme encodé</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Fiche Modal */}
      {ficheModalOpen && (
        <div className={adminStyles['validation-panel']}>
          <div className={adminStyles['panel-header']}>
            <h2>📋 Fiches de renseignement</h2>
            <button className={adminStyles['close-btn']} onClick={() => setFicheModalOpen(false)}>✕</button>
          </div>
          <div className={adminStyles['panel-content']}>
            {ficheUsers.length === 0 ? (
              <div style={{padding:20,textAlign:'center',color:'#6b7280'}}>📭 Aucune fiche en attente</div>
            ) : (
              ficheUsers.map(user => (
                <div key={user.id} style={{padding:16,borderBottom:'1px solid #e5e7eb'}}>
                  <div style={{fontWeight:600,marginBottom:4}}>{user.first_name} {user.last_name}</div>
                  <div style={{fontSize:13,color:'#6b7280',marginBottom:8}}>{user.email}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>Rôle: {user.role} • Téléphone: {user.phone || '-'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Avoirs Modal */}
      {avoirsModalOpen && (
        <div className={adminStyles['validation-panel']}>
          <div className={adminStyles['panel-header']}>
            <h2>📋 Historique des avoirs</h2>
            <button className={adminStyles['close-btn']} onClick={() => setAvoirsModalOpen(false)}>✕</button>
          </div>
          <div className={adminStyles['panel-content']}>
            {avoirsLoading ? (
              <div style={{padding:20,textAlign:'center',color:'#6b7280'}}>⏳ Chargement...</div>
            ) : avoirs.length === 0 ? (
              <div style={{padding:20,textAlign:'center',color:'#6b7280'}}>📭 Aucun avoir enregistré</div>
            ) : (
              avoirs.map((avoir, idx) => (
                <div key={idx} style={{padding:16,borderBottom:'1px solid #e5e7eb'}}>
                  <div style={{fontWeight:600,marginBottom:4}}>Avoir de {avoir.amount}€</div>
                  <div style={{fontSize:13,color:'#6b7280',marginBottom:4}}>Facture: {avoir.invoice_number}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>Raison: {avoir.reason}</div>
                  <div style={{fontSize:12,color:'#9ca3af',marginTop:4}}>Créé le: {new Date(avoir.created_at).toLocaleString('fr-FR')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Correction Wizard */}
      {correctionWizardOpen && (
        <div className={adminStyles['validation-panel']} style={{maxWidth:600}}>
          <div className={adminStyles['panel-header']}>
            <h2>⚠️ Correction facture - Étape {correctionStep}/4</h2>
            <button className={adminStyles['close-btn']} onClick={resetCorrectionWizard}>✕</button>
          </div>
          <div className={adminStyles['panel-content']}>
            {correctionLoadingData ? (
              <div style={{padding:20,textAlign:'center',color:'#6b7280'}}>⏳ Chargement des données...</div>
            ) : correctionStep === 1 ? (
              <div>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontWeight:600,marginBottom:8}}>1. Sélectionnez l'utilisateur</label>
                  <select
                    value={correctionSelectedUserId}
                    onChange={e => {setCorrectionSelectedUserId(e.target.value); setCorrectionStep(2)}}
                    style={{width:'100%',padding:10,borderRadius:6,border:'1px solid #d1d5db'}}
                  >
                    <option value="">-- Choisir --</option>
                    {[...new Set(correctionAllPrestations.map(p => p.user_id))].map(uid => {
                      const p = correctionAllPrestations.find(p => p.user_id === uid)
                      return <option key={uid} value={uid}>{p?.user_name || `${p?.first_name} ${p?.last_name}`}</option>
                    })}
                  </select>
                </div>
              </div>
            ) : correctionStep === 2 ? (
              <div>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontWeight:600,marginBottom:8}}>2. Sélectionnez la facture</label>
                  <select
                    value={correctionSelectedInvoice}
                    onChange={e => {setCorrectionSelectedInvoice(e.target.value); setCorrectionStep(3)}}
                    style={{width:'100%',padding:10,borderRadius:6,border:'1px solid #d1d5db'}}
                  >
                    <option value="">-- Choisir --</option>
                    {[...new Set(correctionAllPrestations.filter(p => p.user_id === Number(correctionSelectedUserId)).map(p => p.invoice_number))].filter(Boolean).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setCorrectionStep(1)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #d1d5db',background:'#f3f4f6',cursor:'pointer'}}>← Retour</button>
              </div>
            ) : correctionStep === 3 ? (
              <div>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontWeight:600,marginBottom:8}}>3. Sélectionnez la prestation à corriger</label>
                  <select
                    value={correctionSelectedPrestation?.id || ''}
                    onChange={e => {
                      const p = correctionAllPrestations.find(pr => pr.id === Number(e.target.value))
                      setCorrectionSelectedPrestation(p)
                      setCorrectionStep(4)
                    }}
                    style={{width:'100%',padding:10,borderRadius:6,border:'1px solid #d1d5db'}}
                  >
                    <option value="">-- Choisir --</option>
                    {correctionAllPrestations.filter(p => p.user_id === Number(correctionSelectedUserId) && p.invoice_number === correctionSelectedInvoice).map(p => (
                      <option key={p.id} value={p.id}>Prestation #{p.id} - {p.date} - {parseFloat(p.remuneration || 0).toFixed(2)}€</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setCorrectionStep(2)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #d1d5db',background:'#f3f4f6',cursor:'pointer'}}>← Retour</button>
              </div>
            ) : correctionStep === 4 ? (
              <div>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontWeight:600,marginBottom:8}}>4. Montant de la correction (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={correctionAmount}
                    onChange={e => setCorrectionAmount(e.target.value)}
                    placeholder="Ex: 50.00"
                    style={{width:'100%',padding:10,borderRadius:6,border:'1px solid #d1d5db'}}
                  />
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{display:'block',fontWeight:600,marginBottom:8}}>Raison de la correction</label>
                  <textarea
                    value={correctionReason}
                    onChange={e => setCorrectionReason(e.target.value)}
                    placeholder="Expliquez pourquoi cette correction est nécessaire..."
                    rows={4}
                    style={{width:'100%',padding:10,borderRadius:6,border:'1px solid #d1d5db',resize:'vertical'}}
                  />
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setCorrectionStep(3)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #d1d5db',background:'#f3f4f6',cursor:'pointer'}}>← Retour</button>
                  <button
                    onClick={submitCorrectionAvoir}
                    disabled={correctionSubmitting}
                    style={{padding:'8px 16px',borderRadius:6,border:'none',background:correctionSubmitting?'#9ca3af':'#f59e0b',color:'#fff',cursor:correctionSubmitting?'not-allowed':'pointer',fontWeight:600}}
                  >
                    {correctionSubmitting ? '⏳ Création...' : '✅ Créer l\'avoir'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase()
  let bg = '#f3f4f6'
  let color = '#374151'
  let text = status || '-'

  if (normalized.includes('payé') || normalized === 'paid') {
    bg = '#d1fae5'
    color = '#065f46'
    text = 'Payé'
  } else if (normalized.includes('facturé') || normalized === 'invoiced') {
    bg = '#dbeafe'
    color = '#1e40af'
    text = 'Facturé'
  } else if (normalized.includes('facturation') || normalized === 'sent_to_billing') {
    bg = '#fef3c7'
    color = '#92400e'
    text = 'À facturer'
  } else if (normalized.includes('rejet') || normalized === 'rejected') {
    bg = '#fee2e2'
    color = '#991b1b'
    text = 'Rejeté'
  } else if (normalized.includes('attente') || normalized === 'pending') {
    bg = '#fef3c7'
    color = '#92400e'
    text = 'En attente'
  }

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: bg,
      color: color,
      whiteSpace: 'nowrap'
    }}>
      {text}
    </span>
  )
}
