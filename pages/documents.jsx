import React, { useEffect, useState } from 'react'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'

export default function DocumentsPage() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDocuments() {
      setLoading(true)
      try {
        const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
        if (!email) {
          setDocuments([])
          return
        }
        
        const r = await fetch(`/api/documents?email=${encodeURIComponent(email)}`)
        if (!r.ok) {
          setDocuments([])
          return
        }
        
        const data = await r.json()
        setDocuments(data.documents || [])
      } catch (err) {
        console.error('Error loading documents:', err)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }
    
    loadDocuments()
  }, [])

  const getStatusBadge = (status, reason) => {
    switch (status) {
      case 'approved':
        return (
          <div className="status-badge approved">
            <span className="status-icon">✅</span>
            <span className="status-label">Validé</span>
          </div>
        )
      case 'rejected':
        return (
          <div className="status-badge rejected" title={reason || ''}>
            <span className="status-icon">❌</span>
            <span className="status-label">Rejeté</span>
          </div>
        )
      case 'pending':
      default:
        return (
          <div className="status-badge pending">
            <span className="status-icon">⏳</span>
            <span className="status-label">En attente</span>
          </div>
        )
    }
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>📄 Mes documents</h1>
          <div className="small-muted">Tous vos documents uploadés et leurs statuts de validation</div>
        </div>

        {loading ? (
          <div className="admin-card card">
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
              <p>Chargement des documents...</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="admin-card card">
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📋</p>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#666' }}>
                Aucun document
              </p>
              <p style={{ fontSize: '14px', color: '#999' }}>
                Les documents que vous uploadez apparaîtront ici
              </p>
            </div>
          </div>
        ) : (
          <div className="documents-container">
            <div className="documents-grid">
              {documents.map(doc => (
                <div key={doc.id} className="document-card">
                  <div className="doc-card-header">
                    <div className="doc-type-badge">
                      {doc.type === 'PDF' ? '📄' : '📎'} {doc.type}
                    </div>
                    {getStatusBadge(doc.validation_status, doc.rejection_reason)}
                  </div>

                  <div className="doc-card-content">
                    <h3 className="doc-name">{doc.name}</h3>
                    
                    <div className="doc-info">
                      <div className="info-item">
                        <span className="info-label">Date:</span>
                        <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Taille:</span>
                        <span>{(doc.file_size / 1024).toFixed(2)} KB</span>
                      </div>
                    </div>

                    {doc.validation_status === 'rejected' && doc.rejection_reason && (
                      <div className="rejection-reason">
                        <strong>Raison du rejet:</strong>
                        <p>{doc.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="doc-card-footer">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-view"
                    >
                      👁️ Voir le document
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {documents.some(d => d.validation_status === 'rejected') && (
              <div className="admin-card card" style={{ marginTop: '2rem', borderLeft: '4px solid #f44336' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '24px' }}>⚠️</div>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#d32f2f' }}>
                      Document(s) rejeté(s)
                    </h3>
                    <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                      Certains de vos documents ont été rejetés. Veuillez consulter les raisons du rejet
                      ci-dessus et soumettre une nouvelle version si nécessaire.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
