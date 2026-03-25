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
        
        // API call to fetch user documents (to be implemented)
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

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Mes documents</h1>
          <div className="small-muted">Tous les documents générés pour votre compte</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div className="admin-card card">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Chargement...</p>
              </div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
                <p style={{ fontSize: '16px', marginBottom: '10px' }}>📄 Aucun document disponible</p>
                <p style={{ fontSize: '14px', color: '#999' }}>
                  Les documents générés apparaîtront ici
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom du document</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td>{doc.name}</td>
                      <td>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</td>
                      <td>{doc.type}</td>
                      <td>
                        <a href={doc.url} download className="btn btn-sm">
                          Télécharger
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
