import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function RIBValidation() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/documents/pending')
      const d = await r.json()
      setDocuments(d.documents || [])
    } catch (e) {
      showToast('Erreur lors du chargement', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function selectDoc(doc) {
    setSelected(doc)
    setRejectMode(false)
    setRejectReason('')
  }

  async function handleValidate(status) {
    if (status === 'rejected' && !rejectReason.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selected.id, status, reason: rejectReason })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      showToast(status === 'approved' ? '\u2705 Document valid\u00e9 !' : '\u274c Document rejet\u00e9', status === 'approved' ? 'success' : 'error')
      setDocuments(prev => prev.filter(doc => doc.id !== selected.id))
      setSelected(null)
      setRejectMode(false)
      setRejectReason('')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const fmt = (bytes) => bytes ? (bytes / 1024).toFixed(1) + ' KB' : '-'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'

  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content" style={{ padding: 0 }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14,
            background: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'fadeIn 0.2s ease'
          }}>{toast.msg}</div>
        )}

        <div style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 60px)' }}>

          {/* LEFT: document list */}
          <div style={{
            width: selected ? 340 : '100%',
            minWidth: 280,
            borderRight: '1px solid #e5e7eb',
            overflowY: 'auto',
            background: '#f9fafb',
            transition: 'width 0.2s ease',
            flexShrink: 0
          }}>
            <div style={{ padding: '20px 16px 12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f2937' }}>
                Validation RIB
              </h1>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {loading ? 'Chargement\u2026' : `${documents.length} document(s) en attente`}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chargement\u2026</div>
            ) : documents.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>\u2705</div>
                <div style={{ fontWeight: 600, color: '#374151' }}>Aucun document en attente</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Tous les RIB ont \u00e9t\u00e9 trait\u00e9s</div>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {documents.map(doc => (
                  <div key={doc.id}
                    onClick={() => selectDoc(doc)}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                      background: selected?.id === doc.id ? '#eff6ff' : '#fff',
                      borderLeft: selected?.id === doc.id ? '3px solid #3b82f6' : '3px solid transparent',
                      transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{doc.user_name || 'Inconnu'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(doc.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{doc.email}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                      \U0001f4c4 {doc.name} \u00b7 {fmt(doc.file_size)}
                    </div>
                    <div style={{
                      display: 'inline-block', marginTop: 6,
                      padding: '2px 8px', borderRadius: 10,
                      background: '#fef3c7', color: '#92400e',
                      fontSize: 11, fontWeight: 600
                    }}>\u23f3 En attente</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: detail + PDF */}
          {selected && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>

              {/* Header */}
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#fff', flexShrink: 0
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>{selected.user_name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{selected.email}</div>
                </div>
                <button onClick={() => { setSelected(null); setRejectMode(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1 }}>
                  \u00d7
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* PDF iframe */}
                <div style={{ flex: 1, background: '#374151', position: 'relative' }}>
                  <iframe
                    src={`/api/documents/serve?id=${selected.id}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Aperçu RIB"
                  />
                </div>

                {/* Side panel: info + actions */}
                <div style={{ width: 280, borderLeft: '1px solid #e5e7eb', overflowY: 'auto', flexShrink: 0 }}>
                  
                  {/* User info */}
                  <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Informations
                    </div>
                    {[
                      ['Nom', selected.user_name],
                      ['Email', selected.email],
                      ['T\u00e9l\u00e9phone', selected.phone],
                      ['Soci\u00e9t\u00e9', selected.company_name],
                      ['BCE', selected.bce],
                      ['NISS', selected.niss],
                      ['Compte', selected.account],
                      ['Adresse', selected.address],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 13, color: '#1f2937', wordBreak: 'break-all' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Document info */}
                  <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Fichier
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>\U0001f4c4 {selected.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{fmt(selected.file_size)} \u00b7 {fmtDate(selected.created_at)}</div>
                    <a href={`/api/documents/serve?id=${selected.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
                      \U0001f517 Ouvrir dans un nouvel onglet
                    </a>
                  </div>

                  {/* Actions */}
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                      D\u00e9cision
                    </div>

                    {!rejectMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                          onClick={() => handleValidate('approved')}
                          disabled={busy}
                          style={{
                            padding: '10px 16px', borderRadius: 8, border: 'none',
                            background: busy ? '#d1d5db' : '#10b981', color: '#fff',
                            fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busy ? 'En cours\u2026' : '\u2705 Valider le RIB'}
                        </button>
                        <button
                          onClick={() => setRejectMode(true)}
                          disabled={busy}
                          style={{
                            padding: '10px 16px', borderRadius: 8, border: '1px solid #fca5a5',
                            background: '#fff', color: '#dc2626',
                            fontWeight: 600, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer'
                          }}
                        >
                          \u274c Rejeter
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 600 }}>Raison du rejet :</div>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Expliquez pourquoi ce document est rejet\u00e9..."
                          rows={4}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: 6,
                            border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical',
                            fontFamily: 'inherit', boxSizing: 'border-box'
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => handleValidate('rejected')}
                            disabled={busy || !rejectReason.trim()}
                            style={{
                              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                              background: busy || !rejectReason.trim() ? '#fca5a5' : '#dc2626',
                              color: '#fff', fontWeight: 700, fontSize: 13,
                              cursor: busy || !rejectReason.trim() ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => { setRejectMode(false); setRejectReason('') }}
                            style={{
                              flex: 1, padding: '9px', borderRadius: 8,
                              border: '1px solid #d1d5db', background: '#fff',
                              color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
