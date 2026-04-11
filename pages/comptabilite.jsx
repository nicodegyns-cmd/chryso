import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import adminStyles from './admin/rib-validation.module.css'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function ComptabilitePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('sent_to_billing') // Default filter
  const [searchQuery, setSearchQuery] = useState('')
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
  const [selectedPrestation, setSelectedPrestation] = useState(null)
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false)
  const [confirmPaymentItem, setConfirmPaymentItem] = useState(null)
  const [exportingIds, setExportingIds] = useState({})

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
        
        // Priority 1: If onboarding not complete, go to profile (only for INFI/MED roles)
        const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
        if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
          router.push('/profile')
        }
        // Priority 2: If onboarding complete but not active, show pending validation
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
    // Only check if userRole has been initialized (not null)
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

  // Fetch prestations sent to billing
  useEffect(() => {
    fetchPrestations()
  }, [filterStatus])

  // Fetch pending documents (for RIB count)
  useEffect(() => {
    let mounted = true
    async function fetchPendingDocs() {
      try {
        const res = await fetch('/api/admin/documents/pending')
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
        console.warn('Failed loading pending docs', err.message)
      }
    }
    fetchPendingDocs()
    return () => { mounted = false }
  }, [])

  async function openRibModal() {
    setRibModalOpen(true)
    try {
      const res = await fetch('/api/admin/documents/pending')
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
      // remove from list
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

  // Fetch active validated users count (INFI/MED) for fiche counter
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

  async function fetchPrestations() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStatus === 'sent_to_billing') {
        params.append('status', 'sent_to_billing')
      } else if (filterStatus === 'invoiced') {
        params.append('status', 'invoiced')
      } else if (filterStatus === 'paid') {
        params.append('status', 'paid')
      }

      const res = await fetch(`/api/comptabilite/prestations?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors de la récupération')

      const data = await res.json()
      setPrestations(Array.isArray(data) ? data : data.prestations || [])
    } catch (err) {
      setError(err.message)
      setPrestations([])
    } finally {
      setLoading(false)
    }
  }

  async function exportPdfForAnalytic(analyticId, analyticName) {
    const analyticPrestations = safePrestations.filter(p => {
      const pAnalyticId = p.analytic_id || 'unassigned'
      return pAnalyticId === (analyticId === 'unassigned' ? 'unassigned' : analyticId)
    })
    
    if (analyticPrestations.length === 0) {
      alert('❌ Aucune prestation à exporter pour cette analytique')
      return
    }

    // Seules les prestations avec un PDF généré peuvent être fusionnées
    const withPdf = analyticPrestations.filter(p => p.pdf_url)
    if (withPdf.length === 0) {
      alert('❌ Aucune facture PDF générée pour cette analytique.\nLes PDFs doivent être générés avant l\'export.')
      return
    }
    if (withPdf.length < analyticPrestations.length) {
      const missing = analyticPrestations.length - withPdf.length
      const ok = confirm(`⚠️ ${missing} prestation(s) sans PDF seront ignorées.\nExporter les ${withPdf.length} factures disponibles ?`)
      if (!ok) return
    }

    setExportingIds(prev => ({ ...prev, [analyticId]: true }))
    try {
      const prestationIds = withPdf.map(p => p.id)

      const res = await fetch('/api/comptabilite/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestationIds,
          analytic_id: analyticId !== 'unassigned' ? analyticId : null,
          analyticName
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur lors de l\'export')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Factures_${analyticName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Mark prestations as exported
      const markRes = await fetch('/api/comptabilite/mark-exported', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          analytic_id: analyticId !== 'unassigned' ? analyticId : null, 
          prestationIds 
        })
      })
      if (!markRes.ok) {
        console.warn('Failed to mark prestations as exported')
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      fetchPrestations()
    } catch (err) {
      console.error('Export failed:', err)
      alert('❌ Erreur lors de l\'export: ' + err.message)
    } finally {
      setExportingIds(prev => { const n = { ...prev }; delete n[analyticId]; return n })
    }
  }

  // Guard against null entries returned by APIs
  const safePrestations = (prestations || []).filter(Boolean)

  const filteredPrestations = safePrestations.filter(p => {
    const query = (searchQuery || '').toLowerCase()
    return (
      (p.user_name || '').toString().toLowerCase().includes(query) ||
      (p.first_name || '').toString().toLowerCase().includes(query) ||
      (p.last_name || '').toString().toLowerCase().includes(query) ||
      (p.email || '').toString().toLowerCase().includes(query) ||
      (p.activity_type || '').toString().toLowerCase().includes(query)
    )
  })

  // Basic stats for cards
  const pendingPrestations = safePrestations.filter(p => (p && p.status) === 'sent_to_billing')
  const pendingCount = pendingPrestations.length
  const pendingAmount = pendingPrestations.reduce((sum, p) => sum + (parseFloat(p && p.remuneration) || 0), 0)
  if (userRole && userRole !== 'comptabilite') {
    return null
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        {/* Header */}
        <div style={{marginBottom: 32}}>
          <h1 style={{fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8}}>
            💰 Gestion des Prestations à Facturer
          </h1>
          <p style={{color: '#6b7280', fontSize: 14}}>
            Tableau de bord comptabilité - Prestations en attente de facturation
          </p>
        </div>

        {/* Stat cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24}}>
          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>📤 En attente de facturation</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827'}}>{pendingCount}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Montant estimé: {pendingAmount.toFixed(2)} €</div>
          </div>

          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>🧾 Total Prestations</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827'}}>{safePrestations.length}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Montant total: {safePrestations.reduce((s,p)=> s + (parseFloat(p && p.remuneration || 0)||0),0).toFixed(2)} €</div>
          </div>

          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>🏦 RIB en attente d'encodage</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer'}} onClick={openRibModal}>{ribPendingCount}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Documents RIB soumis par les utilisateurs</div>
          </div>
            <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
              <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>📋 Fiches renseignement</div>
                <div style={{fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer'}} onClick={openFicheModal}>{fichePendingCount}</div>
              <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Prestataires validés (INFI / MED)</div>
            </div>
        </div>

        {/* Filters */}
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
                placeholder="Nom, email, activité..."
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: 'white'
                }}
              >
                <option value="sent_to_billing">À facturer</option>
                <option value="invoiced">Facturées</option>
                <option value="paid">Payées</option>
                <option value="all">Toutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Export Button */}
        {/* Removed - now each analytic has its own export button */}

        {/* Prestations by Analytic - Grouped View */}
        {loading ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8}}>
            <div style={{fontSize: 14}}>⏳ Chargement des prestations...</div>
          </div>
        ) : error ? (
          <div style={{padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 6}}>
            <strong>❌ Erreur :</strong> {error}
          </div>
        ) : filteredPrestations.length === 0 ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8}}>
            <div style={{fontSize: 32, marginBottom: 8}}>📭</div>
            <div style={{fontSize: 14}}>Aucune prestation trouvée</div>
          </div>
        ) : (
          <>
            {Object.entries(
              filteredPrestations.reduce((groups, p) => {
                // Create unique key from analytic_id or name
                const analyticId = p.analytic_id || 'unassigned'
                const analyticName = p.analytic_name || 'Non assigné'
                const groupKey = `${analyticId}|${analyticName}`
                
                if (!groups[groupKey]) {
                  groups[groupKey] = {
                    items: [],
                    analyticId,
                    analyticName
                  }
                }
                groups[groupKey].items.push(p)
                return groups
              }, {})
            ).map(([groupKey, analyticGroup]) => {
              const { items: analyticsItems, analyticId, analyticName } = analyticGroup
              const analyticTotal = analyticsItems.reduce((sum, p) => sum + parseFloat(p.remuneration || 0), 0)
              
              return (
                <div key={groupKey} style={{marginBottom: 32}}>
                  {/* Analytic Header with Export Button */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <div>
                      <h2 style={{fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4}}>
                        📊 {analyticName}
                      </h2>
                      <p style={{fontSize: 12, color: '#6b7280'}}>
                        {analyticsItems.length} prestation{analyticsItems.length > 1 ? 's' : ''} • Montant total: {analyticTotal.toFixed(2)} €
                      </p>
                    </div>
                    <button
                      onClick={() => exportPdfForAnalytic(analyticId, analyticName)}
                      disabled={exportingIds[analyticId] || analyticsItems.length === 0}
                      style={{
                        padding: '10px 16px',
                        background: analyticsItems.length === 0 ? '#d1d5db' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: analyticsItems.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        opacity: exportingIds[analyticId] ? 0.7 : 1,
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        if (analyticsItems.length > 0) e.target.style.background = '#059669'
                      }}
                      onMouseLeave={(e) => {
                        if (analyticsItems.length > 0) e.target.style.background = '#10b981'
                      }}
                    >
                      {exportingIds[analyticId] ? '⏳ Export en cours...' : '📄 Exporter'}
                    </button>
                  </div>

                  {/* Analytic Table */}
                  <div style={{
                    background: 'white',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                  }}>
                    <div style={{overflowX: 'auto'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr style={{background: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Collaborateur</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Activité</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Montant</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Date</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Statut</th>
                            <th style={{padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151'}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsItems.map((prestation, idx) => (
                            <tr key={prestation.id || idx} style={{borderBottom: '1px solid #e5e7eb'}}>
                              <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                                {prestation.user_name || `${prestation.first_name} ${prestation.last_name}`.trim()}
                              </td>
                              <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                                {prestation.activity_type || '-'}
                              </td>
                              <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                                {parseFloat(prestation.remuneration || 0).toFixed(2)} €
                              </td>
                              <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                                {new Date(prestation.date || prestation.created_at).toLocaleDateString('fr-FR')}
                              </td>
                              <td style={{padding: 12, fontSize: 13}}>
                                <StatusBadge status={prestation.status} />
                              </td>
                              <td style={{padding: 12, textAlign: 'center'}}>
                                <div style={{display: 'flex', gap: 6, justifyContent: 'center'}}>
                                  <button
                                    onClick={() => setSelectedPrestation(prestation)}
                                    title="Détails"
                                    style={{
                                      padding: '6px 10px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                  >
                                    👁️
                                  </button>
                                  {prestation.status === 'sent_to_billing' && (
                                    <button
                                      onClick={() => {}}
                                      title="Marquer comme facturé"
                                      style={{
                                        padding: '6px 10px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        transition: 'background 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = '#059669'}
                                      onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                    >
                                      ✅
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
      {/* Prestation detail panel (admin-styled) */}
      {selectedPrestation && (
        <div className={adminStyles['validation-panel']}>
          <div className={adminStyles['panel-header']}>
            <h2>🔎 Détails de la prestation</h2>
            <button className={adminStyles['close-btn']} onClick={() => setSelectedPrestation(null)}>✕</button>
          </div>

          <div className={adminStyles['panel-content']}>
            <div className={adminStyles['user-full-info']}>
              <h3>👤 Collaborateur</h3>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Nom:</span>
                <span>{selectedPrestation.user_name || `${selectedPrestation.first_name || ''} ${selectedPrestation.last_name || ''}`.trim()}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Date:</span>
                <span>{new Date(selectedPrestation.date || selectedPrestation.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Activité:</span>
                <span>{selectedPrestation.analytic_name || selectedPrestation.activity_type || '-'}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>ID Ebrigade:</span>
                <span>{selectedPrestation.ebrigade_activity_code || '-'}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Montant:</span>
                <span>{(parseFloat(selectedPrestation.remuneration || 0) || 0).toFixed(2)} €</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Statut:</span>
                <span>{selectedPrestation.status || '-'}</span>
              </div>
            </div>

            <div className={adminStyles['document-preview']}>
              <h3>📝 Commentaires</h3>
              <div className={adminStyles['document-info']}>
                <p>{selectedPrestation.comments || 'Aucun commentaire'}</p>
              </div>
            </div>

            {/* PDF buttons only - no card */}
            <div style={{display:'flex',gap:8,marginTop:12}}>
              {selectedPrestation.pdf_url ? (
                <a href={selectedPrestation.pdf_url} target="_blank" rel="noreferrer" className={adminStyles['view-document-btn']}>👁️ Voir le PDF</a>
              ) : (
                <button disabled style={{padding:'8px 12px',background:'#9ca3af',color:'#fff',borderRadius:6,border:'none'}}>Aucun PDF</button>
              )}
              {selectedPrestation.pdf_url ? (
                <a href={selectedPrestation.pdf_url} download style={{padding:'8px 12px',background:'#6b7280',color:'#fff',borderRadius:6,textDecoration:'none',display:'inline-block',textAlign:'center'}}>Télécharger</a>
              ) : null}
              <button onClick={() => { setConfirmPaymentItem(selectedPrestation); setConfirmPaymentOpen(true); }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Encodé</button>
            </div>

            <div className={adminStyles['validation-actions']}>
              <button className={adminStyles['btn-approve']} onClick={() => setSelectedPrestation(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm payment encoded modal */}
      {confirmPaymentOpen && confirmPaymentItem && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => { setConfirmPaymentOpen(false); setConfirmPaymentItem(null); }}>
          <div style={{background:'#fff',borderRadius:10,width:420,maxWidth:'90%',padding:20,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Confirmer l'encodage du paiement</h3>
            <p style={{color:'#374151'}}>Voulez-vous confirmer que le paiement pour <strong>{confirmPaymentItem.user_name || confirmPaymentItem.email}</strong> (prestation #{confirmPaymentItem.id}) est encodé ?</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button onClick={() => { setConfirmPaymentOpen(false); setConfirmPaymentItem(null); }} style={{padding:'8px 12px',background:'#f3f4f6',borderRadius:6,border:'none',cursor:'pointer'}}>Annuler</button>
              <button onClick={async () => {
                try {
                  // call API to update prestation status to 'Payé'
                  const res = await fetch(`/api/admin/prestations/${confirmPaymentItem.id}`, {
                    method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Payé' })
                  })
                  if (!res.ok) throw new Error('Erreur serveur')
                  // Refresh the list to remove encoded item (it's now filtered out)
                  await fetchPrestations()
                } catch (e) {
                  console.error('Encodage paiement failed', e)
                  alert('Erreur lors de l\'encodage du paiement')
                } finally {
                  setConfirmPaymentOpen(false)
                  setConfirmPaymentItem(null)
                  setSelectedPrestation(null)
                }
              }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {/* RIB Modal */}
      {ribModalOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200}} onClick={() => setRibModalOpen(false)}>
          <div style={{background:'#fff',borderRadius:8,width:'95%',maxWidth:1100,maxHeight:'90vh',overflow:'auto',padding:20}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h2 style={{margin:0}}>🧾 RIB en attente ({ribDocuments.length})</h2>
              <button onClick={() => setRibModalOpen(false)} style={{border:'none',background:'transparent',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>
            <div className={adminStyles['documents-grid']}>
              {ribDocuments.length === 0 ? (
                <div style={{padding:20,color:'#6b7280'}}>Aucun RIB en attente</div>
              ) : ribDocuments.map(doc => (
                <div key={doc.id} className={adminStyles['document-card']} onClick={() => {}}>
                  <div className={adminStyles['doc-header']}>
                    <div className={adminStyles['doc-type-badge']}>📄 {doc.type || 'RIB'}</div>
                    <div className={adminStyles['doc-date']}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>

                  <div className={adminStyles['user-info']}>
                    <h3>{doc.user_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim()}</h3>
                    <p className={adminStyles.email}>📧 {doc.email || ''}</p>
                    {doc.phone && <p className={adminStyles.phone}>📱 {doc.phone}</p>}
                    {doc.company_name && <p className={adminStyles.company}>🏢 {doc.company_name}</p>}
                    {doc.address && <p className={adminStyles.city}>📍 {doc.address}</p>}
                  </div>

                  <div className={adminStyles['doc-filename']}>
                    <strong>Fichier:</strong> {doc.name}
                  </div>

                  <div className={adminStyles['doc-size']}>
                    <strong>Taille:</strong> {(doc.file_size / 1024).toFixed(2)} KB
                  </div>

                  <div className={`${adminStyles['status-badge']} ${adminStyles.pending}`}>⏳ En attente</div>

                  <div style={{marginTop:12, display:'flex', gap:8}}>
                    <a href={doc.url} target="_blank" rel="noreferrer" className={adminStyles['view-document-btn']}>Voir</a>
                    <a href={doc.url} download style={{padding:'8px 12px',background:'#6b7280',color:'#fff',borderRadius:6,textDecoration:'none',textAlign:'center'}}>Télécharger</a>
                      <button onClick={() => { setConfirmDoc(doc); setConfirmEncodeOpen(true); }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Encodé</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Fiche Modal */}
      {ficheModalOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200}} onClick={() => setFicheModalOpen(false)}>
          <div style={{background:'#fff',borderRadius:8,width:'95%',maxWidth:1100,maxHeight:'90vh',overflow:'auto',padding:20}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h2 style={{margin:0}}>Fiches de renseignement ({ficheUsers.length})</h2>
              <button onClick={() => setFicheModalOpen(false)} style={{border:'none',background:'transparent',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>
            <div className={adminStyles['documents-grid']}>
              {ficheUsers.length === 0 ? (
                <div style={{padding:20,color:'#6b7280'}}>Aucune fiche disponible</div>
              ) : ficheUsers.map(u => (
                <div key={u.id} className={adminStyles['document-card']} onClick={() => {}}>
                  <div className={adminStyles['doc-header']}>
                    <div className={adminStyles['doc-type-badge']}>👤 Fiche</div>
                    <div className={adminStyles['doc-date']}>{new Date().toLocaleDateString('fr-FR')}</div>
                  </div>

                  <div className={adminStyles['user-info']}>
                    <h3>{(u.first_name || '') + ' ' + (u.last_name || '')}</h3>
                    {u.company && <p className={adminStyles.company}>🏢 {u.company}</p>}
                    {u.address && <p className={adminStyles.city}>📍 {u.address}</p>}
                  </div>

                  <div style={{marginTop:12}}>
                    <button onClick={() => { setSelectedFiche(u); setFicheViewerOpen(true); }} className={adminStyles['view-document-btn']}>Voir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Fiche Viewer Modal - Detailed view without sensitive info */}
      {ficheViewerOpen && selectedFiche && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => setFicheViewerOpen(false)}>
          <div style={{background:'#fff',borderRadius:10,width:'95%',maxWidth:600,maxHeight:'90vh',overflow:'auto',padding:40,boxShadow:'0 10px 40px rgba(0,0,0,0.3)'}} onClick={(e)=>e.stopPropagation()}>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:30}}>
              <div>
                <h1 style={{margin:'0 0 8px 0',fontSize:28,fontWeight:700,color:'#111827'}}>
                  {(selectedFiche.first_name || '') + ' ' + (selectedFiche.last_name || '')}
                </h1>
                <p style={{margin:0,fontSize:14,color:'#6b7280'}}>Fiche renseignement</p>
              </div>
              <button onClick={() => setFicheViewerOpen(false)} style={{border:'none',background:'transparent',fontSize:24,cursor:'pointer',padding:0,color:'#6b7280'}}>✕</button>
            </div>

            {/* Informations personnelles */}
            <div style={{marginBottom:24}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations personnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {selectedFiche.address && (
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Adresse</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Informations professionnelles */}
            <div style={{paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations professionnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {selectedFiche.role && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>R\u00f4le</label>
                    <span style={{background:'#e0e7ff',color:'#3730a3',padding:'4px 10px',borderRadius:4,fontSize:13,fontWeight:600}}>
                      {selectedFiche.role}
                    </span>
                  </div>
                )}
                {selectedFiche.fonction && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Fonction</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.fonction}</p>
                  </div>
                )}
                {selectedFiche.company && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Entreprise</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.company}</p>
                  </div>
                )}
                {selectedFiche.niss && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>NISS</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.niss}</p>
                  </div>
                )}
                {selectedFiche.bce && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>BCE</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.bce}</p>
                  </div>
                )}
                {selectedFiche.account && (
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Compte bancaire</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.account}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{marginTop:30,paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <button onClick={() => setFicheViewerOpen(false)} style={{width:'100%',padding:'10px 16px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Encoded Modal */}
      {confirmEncodeOpen && confirmDoc && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => { setConfirmEncodeOpen(false); setConfirmDoc(null); }}>
          <div style={{background:'#fff',borderRadius:10,width:400,maxWidth:'90%',padding:20,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Confirmer l'encodage</h3>
            <p style={{color:'#374151'}}>Voulez-vous confirmer que le RIB de <strong>{confirmDoc.user_name || confirmDoc.email}</strong> est encodé ?</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button onClick={() => { setConfirmEncodeOpen(false); setConfirmDoc(null); }} style={{padding:'8px 12px',background:'#f3f4f6',borderRadius:6,border:'none',cursor:'pointer'}}>Annuler</button>
              <button onClick={async () => { try { await markAsEncoded(confirmDoc.id); } finally { setConfirmEncodeOpen(false); setConfirmDoc(null); } }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const statusConfig = {
    'Envoyé à la facturation': { bg: '#fef3c7', color: '#92400e', label: '📋 À facturer' },
    'Facturé': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'Payé': { bg: '#dbeafe', color: '#0c4a6e', label: '💳 Payé' },
    // Fallback for old codes
    'sent_to_billing': { bg: '#fef3c7', color: '#92400e', label: '📋 À facturer' },
    'invoiced': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'paid': { bg: '#dbeafe', color: '#0c4a6e', label: '💳 Payé' },
    'pending': { bg: '#f3f4f6', color: '#374151', label: '⏳ En attente' }
  }
  
  const config = statusConfig[status] || { bg: '#f3f4f6', color: '#374151', label: '⏳ Inconnu' }
  
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
