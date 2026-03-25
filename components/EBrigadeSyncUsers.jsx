import React, { useState, useEffect } from 'react'

export default function EBrigadeSyncUsers({ 
  pendingCount: propPendingCount = null, 
  loadingCount: propLoadingCount = false,
  onSyncComplete = null,
  autoShowConfirm = false
}) {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [pendingCount, setPendingCount] = useState(propPendingCount)
  const [showConfirm, setShowConfirm] = useState(autoShowConfirm)
  const [loadingCount, setLoadingCount] = useState(propLoadingCount)
  
  // Selection mode
  const [mode, setMode] = useState('sync-all') // 'sync-all' or 'select-specific'
  const [selectedUsers, setSelectedUsers] = useState(new Set()) // Set of ebrigade IDs
  const [unlinkedUsers, setUnlinkedUsers] = useState([])

  // Load pending count on mount (only if not provided via props)
  useEffect(() => {
    if (propPendingCount === null) {
      loadPendingCount()
    }
  }, [propPendingCount])

  // Open confirmation automatically if autoShowConfirm is true
  useEffect(() => {
    if (autoShowConfirm) {
      setShowConfirm(true)
    }
  }, [autoShowConfirm])

  async function loadPendingCount() {
    setLoadingCount(true)
    try {
      const resp = await fetch('/api/admin/users/pending-count')
      if (resp.ok) {
        const data = await resp.json()
        console.log('Pending count loaded:', data)
        setPendingCount(data.pendingCount)
        setUnlinkedUsers(data.unlinkedUsers || []) // Store unlinked users list
        setResults(data) // Store full data for display
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
      // Determine which endpoint to use
      const endpoint = mode === 'select-specific' 
        ? '/api/admin/users/ebrigade-sync-selected'
        : '/api/admin/users/ebrigade-sync'
      
      const body = mode === 'select-specific'
        ? { selectedIds: Array.from(selectedUsers) }
        : {}

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
        if (onSyncComplete) {
          onSyncComplete()
        } else {
          await loadPendingCount()
        }
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

  function toggleUserSelection(ebrigadeId) {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(ebrigadeId)) {
      newSelected.delete(ebrigadeId)
    } else {
      newSelected.add(ebrigadeId)
    }
    setSelectedUsers(newSelected)
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => { setMode('sync-all'); setSelectedUsers(new Set()) }}
          style={{
            padding: '10px 16px',
            backgroundColor: mode === 'sync-all' ? '#3b82f6' : '#e5e7eb',
            color: mode === 'sync-all' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          🔗 Synchroniser tous
        </button>
        <button
          onClick={() => setMode('select-specific')}
          style={{
            padding: '10px 16px',
            backgroundColor: mode === 'select-specific' ? '#3b82f6' : '#e5e7eb',
            color: mode === 'select-specific' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          ✅ Sélectionner individuellement
        </button>
      </div>

      {/* Selection Mode UI */}
      {mode === 'select-specific' && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            backgroundColor: '#f0f4f8',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '14px',
            marginBottom: '12px'
          }}>
            <p style={{ marginTop: 0, marginBottom: '8px', color: '#1e40af', fontWeight: '600' }}>
              Sélectionnez les profils à synchroniser ({selectedUsers.size} sélectionné{selectedUsers.size !== 1 ? 's' : ''})
            </p>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '13px' }}>
              - Cochez les profils à inviter
              <br/>
              - Cliquez "Synchroniser sélectionnés" pour lancer le test
              <br/>
              - Les profils ne seront créés que s'ils ne sont pas dupliquéstes
            </p>
          </div>

          {loadingCount ? (
            <div style={{ color: '#6b7280' }}>🔄 Chargement des profils...</div>
          ) : unlinkedUsers.length === 0 ? (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px' }}>
              <div style={{ color: '#991b1b', fontWeight: '600', marginBottom: '8px' }}>
                ℹ️ Aucun profil disponible pour sélection
              </div>
              {results && (
                <div style={{ color: '#7f1d1d', fontSize: '13px' }}>
                  <p style={{ margin: '8px 0' }}>
                    Profils eBrigade: <strong>{results.totalEbrigadeUsers}</strong>
                  </p>
                  
                  {results.gradeBreakdown && Object.keys(results.gradeBreakdown).length > 0 && (
                    <div style={{ margin: '8px 0', paddingLeft: '12px', borderLeft: '2px solid #fca5a5' }}>
                      <strong>Par grade:</strong>
                      {Object.entries(results.gradeBreakdown).map(([grade, count]) => (
                        <div key={grade} style={{ fontSize: '12px', margin: '4px 0' }}>
                          {grade}: {count}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {results.missingData && results.missingData.count > 0 && (
                    <div style={{ margin: '8px 0', paddingLeft: '12px', borderLeft: '2px solid #fca5a5' }}>
                      <strong>Données manquantes:</strong> {results.missingData.count} profil{results.missingData.count > 1 ? 's' : ''}
                      <div style={{ fontSize: '12px', margin: '4px 0' }}>
                        (email manquant, nom manquant, etc.)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {unlinkedUsers.map((user, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: idx < unlinkedUsers.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: selectedUsers.has(user.ebrigadeId) ? '#eff6ff' : 'white',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleUserSelection(user.ebrigadeId)}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.ebrigadeId)}
                    onChange={() => toggleUserSelection(user.ebrigadeId)}
                    style={{ marginRight: '12px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#1f2937' }}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {user.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedUsers.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={syncing}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: syncing ? 'not-allowed' : 'pointer',
                opacity: syncing ? 0.7 : 1,
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {syncing ? '🔄 Synchronisation...' : '✓ Synchroniser sélectionnés'}
            </button>
          )}
        </div>
      )}

      {/* Sync All Mode - Button */}
      {mode === 'sync-all' && (
        <div style={{ marginBottom: '20px' }}>
          {!autoShowConfirm && (
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
              {syncing ? '🔄 Synchronisation en cours...' : '🔗 Synchroniser tous'}
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
          )}
        </div>
      )}

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
              Êtes-vous sûr de synchroniser les profils eBrigade et d'envoyer les invitations à 
              <strong style={{ color: '#3b82f6' }}>
                {' '}{mode === 'select-specific' ? selectedUsers.size : (pendingCount || 0)} profil{(mode === 'select-specific' ? selectedUsers.size : pendingCount) === 1 ? '' : 's'}{' '}
              </strong>
              non-liés ?
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
            💡 Cette action va:
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>Récupérer les profils depuis eBrigade</li>
              <li>Envoyer des invitations par email</li>
              <li>Les utilisateurs recevront un lien pour compléter leur profil</li>
            </ul>
            {results && results.totalEbrigadeUsers && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#1e40af' }}>
                <strong>Résumé:</strong> {results.totalEbrigadeUsers} profils dans eBrigade, {results.totalEbrigadeUsers - pendingCount} déjà liés, {pendingCount} à synchroniser
              </div>
            )}
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
        {!autoShowConfirm && (
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
        )}
      </div>

      {loadingCount && !error && (
        <div style={{
          backgroundColor: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          color: '#1e40af',
          fontSize: '14px'
        }}>
          🔄 Vérification des profils eBrigade en cours...
        </div>
      )}

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
          {error.includes('not configured') && (
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              ⚠️ Veuillez configurer EBRIGADE_TOKEN dans le fichier .env et redémarrer le serveur.
            </div>
          )}
          {error.includes('eBrigade API error') && (
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              ⚠️ Impossible de contacter eBrigade. Vérifiez EBRIGADE_URL et EBRIGADE_TOKEN.
              <br />
              <a href="/api/admin/users/diagnostic" target="_blank" rel="noopener noreferrer" style={{ color: '#991b1b', textDecoration: 'underline' }}>
                → Vérifier la configuration
              </a>
            </div>
          )}
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
