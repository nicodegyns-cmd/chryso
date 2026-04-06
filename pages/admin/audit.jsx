import React, { useEffect, useState } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminAuditPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAuditLog()
  }, [])

  async function fetchAuditLog() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/audit/acceptances')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAudit(data.items || [])
    } catch (err) {
      console.error('Fetch failed', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Audit des acceptations</h1>
          <div className="small-muted">Historique des acceptations de CGU et politiques</div>
        </div>

        {loading && (
          <div className="admin-card card" style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
            Chargement…
          </div>
        )}

        {error && (
          <div className="admin-card card" style={{ padding: 24, color: '#d32f2f' }}>
            Erreur: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="admin-card card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
                📊 {audit.length} enregistrement(s)
              </div>
              <button
                onClick={fetchAuditLog}
                style={{
                  padding: '8px 12px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ↻ Actualiser
              </button>
            </div>

            {audit.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                Aucun enregistrement pour le moment
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Nom</th>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Email</th>
                      <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>CGU</th>
                      <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Politique</th>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Date & Heure</th>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Adresse IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background = (idx % 2 === 0 ? '#fff' : '#f9fafb')}
                      >
                        <td style={{ padding: 12, color: '#1f2937', fontWeight: 500 }}>
                          {row.firstName || '—'} {row.lastName || '—'}
                        </td>
                        <td style={{ padding: 12, color: '#6b7280' }}>
                          {row.email}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          {row.acceptedCgu ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>✓</span>
                          ) : (
                            <span style={{ color: '#d32f2f' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          {row.acceptedPrivacy ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>✓</span>
                          ) : (
                            <span style={{ color: '#d32f2f' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>
                          {formatDate(row.acceptedAt)}
                        </td>
                        <td style={{ padding: 12, color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>
                          {row.ipAddress || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
