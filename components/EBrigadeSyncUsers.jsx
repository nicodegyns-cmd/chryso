import React, { useState } from 'react'

export default function EBrigadeSyncUsers() {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/admin/users/ebrigade-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      // Get response text first to see what we're dealing with
      const responseText = await response.text()
      console.log('API Response status:', response.status)
      console.log('API Response text:', responseText)

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${responseText || 'Pas de détails'}`)
      }

      // Try to parse JSON
      try {
        const data = JSON.parse(responseText)
        setResults(data)
      } catch (parseErr) {
        throw new Error(`Réponse invalide du serveur: ${responseText.substring(0, 200)}`)
      }
    } catch (err) {
      console.error('Sync error:', err)
      setError(err.message || 'Erreur synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            opacity: syncing ? 0.7 : 1,
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {syncing ? '🔄 Synchronisation en cours...' : '🔗 Synchroniser eBrigade'}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          color: '#991b1b'
        }}>
          <strong>Erreur:</strong> {error}
        </div>
      )}

      {results && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <StatCard 
              label="Utilisateurs eBrigade détectés" 
              value={results.summary.eligibleUsers}
              color="#3b82f6"
            />
            <StatCard 
              label="Nouveaux utilisateurs créés" 
              value={results.summary.created}
              color="#10b981"
            />
            <StatCard 
              label="Invitations envoyées" 
              value={results.summary.emailsSent}
              color="#8b5cf6"
            />
            <StatCard 
              label="Déjà liés" 
              value={results.summary.alreadyLinked}
              color="#f59e0b"
            />
          </div>

          {results.created.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: '#374151' }}>
                ✅ Nouveaux utilisateurs créés ({results.created.length})
              </h4>
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '12px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #86efac' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Prénom</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Nom</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.created.map((user, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #dcfce7' }}>
                        <td style={{ padding: '8px' }}>{user.first_name}</td>
                        <td style={{ padding: '8px' }}>{user.last_name}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results.alreadyLinked.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: '#374151' }}>
                ℹ️ Déjà liés ({results.alreadyLinked.length})
              </h4>
              <div style={{
                backgroundColor: '#fefce8',
                border: '1px solid #fde047',
                borderRadius: '6px',
                padding: '12px',
                maxHeight: '150px',
                overflowY: 'auto',
                fontSize: '13px'
              }}>
                {results.alreadyLinked.slice(0, 5).map((user, i) => (
                  <div key={i} style={{ padding: '4px 0' }}>
                    {user.firstName} {user.lastName} ({user.email})
                  </div>
                ))}
                {results.alreadyLinked.length > 5 && (
                  <div style={{ padding: '4px 0', fontStyle: 'italic', color: '#9a8c3a' }}>
                    ... et {results.alreadyLinked.length - 5} autres
                  </div>
                )}
              </div>
            </div>
          )}

          {results.errors.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: '#374151' }}>
                ⚠️ Erreurs ({results.errors.length})
              </h4>
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                maxHeight: '150px',
                overflowY: 'auto',
                fontSize: '13px'
              }}>
                {results.errors.slice(0, 5).map((err, i) => (
                  <div key={i} style={{ padding: '4px 0', color: '#7f1d1d' }}>
                    {err.ebrigadeId}: {err.reason}
                  </div>
                ))}
                {results.errors.length > 5 && (
                  <div style={{ padding: '4px 0', fontStyle: 'italic', color: '#9f1c1c' }}>
                    ... et {results.errors.length - 5} autres erreurs
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      backgroundColor: '#f9fafb',
      border: `2px solid ${color}`,
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center'
    }}>
      <div style={{ color: '#6b7280', fontSize: '13px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ color, fontSize: '32px', fontWeight: 'bold' }}>
        {value}
      </div>
    </div>
  )
}
