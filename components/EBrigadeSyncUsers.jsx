import React, { useState, useEffect } from 'react'

export default function EBrigadeSyncUsers() {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loadingCount, setLoadingCount] = useState(true)

  // Load pending count on mount
  useEffect(() => {
    loadPendingCount()
  }, [])

  async function loadPendingCount() {
    setLoadingCount(true)
    try {
      const resp = await fetch('/api/admin/users/pending-count')
      if (resp.ok) {
        const data = await resp.json()
        console.log('Pending count loaded:', data)
        setPendingCount(data.pendingCount)
      } else {
        console.error('Error loading pending count:', resp.status)
        setPendingCount(0)
      }
    } catch (err) {
      console.error('Error loading pending count:', err)
      setPendingCount(0)
    } finally {
      setLoadingCount(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setResults(null)
    setShowConfirm(false)

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
        // Refresh pending count after sync
        await loadPendingCount()
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
      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '28px',
            maxWidth: '400px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#1f2937' }}>
              Confirmer la synchronisation
            </h2>
            <p style={{ marginBottom: '24px', color: '#4b5563', fontSize: '15px', lineHeight: '1.5' }}>
              Êtes-vous sûr d'envoyer le lien d'invitation à 
              <strong style={{ color: '#3b82f6' }}> {loadingCount ? '...' : pendingCount} profil{(pendingCount === 0 || pendingCount === 1) ? '' : 's'}</strong> 
              {' '}en attente ?
            </p>
            <div style={{
              backgroundColor: '#f0f4f8',
              borderLeft: '4px solid #3b82f6',
              padding: '12px',
              marginBottom: '24px',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#1e40af'
            }}>
              💡 Les utilisateurs recevront un email avec un lien pour compléter leur profil.
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  opacity: syncing ? 0.7 : 1,
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {syncing ? '🔄 Synchronisation...' : '✓ Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowConfirm(true)}
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
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {syncing ? '🔄 Synchronisation en cours...' : '🔗 Synchroniser eBrigade'}
          {pendingCount !== null && (
            <span style={{
              backgroundColor: '#1e40af',
              borderRadius: '999px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: '600',
              minWidth: '24px',
              textAlign: 'center'
            }}>
              {loadingCount ? '...' : pendingCount}
            </span>
          )}
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
