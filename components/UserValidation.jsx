import React, { useEffect, useState, useMemo } from 'react'

export default function UserValidation() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [validating, setValidating] = useState({})
  const [form, setForm] = useState({
    liaison_ebrigade_id: '',
    role: 'INFI',
    niss: '',
    bce: '',
    account: ''
  })

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  async function fetchPendingUsers() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/users/pending-validation')
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setUsers(d.items || [])
    } catch (e) {
      console.error('fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  function openView(user) {
    setViewing(user)
    setForm({
      liaison_ebrigade_id: user.liaison_ebrigade_id || '',
      role: user.role || 'INFI',
      niss: user.niss || '',
      bce: user.bce || '',
      account: user.account || ''
    })
  }

  async function handleValidate(userId) {
    if (!form.role) {
      alert('Veuillez sélectionner un rôle')
      return
    }
    
    if (validating[userId]) return
    setValidating(prev => ({ ...prev, [userId]: true }))

    try {
      const r = await fetch(`/api/admin/users/${userId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!r.ok) {
        const errorData = await r.json()
        throw new Error(errorData.error || 'Erreur lors de la validation')
      }

      setUsers(prev => prev.filter(u => u.id !== userId))
      setViewing(null)
      alert('✓ Utilisateur validé et activé avec succès!')
    } catch (e) {
      console.error('validate failed', e)
      alert(`Erreur: ${e.message}`)
    } finally {
      setValidating(prev => { const c = { ...prev }; delete c[userId]; return c })
    }
  }

  async function handleReject(userId) {
    if (!confirm('Rejeter cet utilisateur? Son compte sera supprimé.')) return

    try {
      const r = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('delete failed')
      setUsers(prev => prev.filter(u => u.id !== userId))
      setViewing(null)
    } catch (e) {
      console.error('reject failed', e)
      alert('Erreur lors du rejet')
    }
  }

  const pending = useMemo(() => users.filter(u => u.onboarding_status === 'pending_validation'), [users])

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280' }}>Chargement…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>📋 {pending.length} utilisateur(s) en attente de validation</div>
      </div>

      {pending.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Aucune demande en attente</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {pending.map(user => (
            <div
              key={user.id}
              style={{
                padding: 16,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => openView(user)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0366d6'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{user.first_name} {user.last_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{user.email}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Rôle: <strong>{user.role || 'Non défini'}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Cliquez pour compléter →</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de validation */}
      {viewing && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>✅ Valider: {viewing.first_name} {viewing.last_name}</h2>

            <div style={{ display: 'grid', gap: 16, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Email</div>
                <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 500 }}>{viewing.email}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Prénom</div>
                  <div style={{ fontSize: 14, color: '#1f2937' }}>{viewing.first_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Nom</div>
                  <div style={{ fontSize: 14, color: '#1f2937' }}>{viewing.last_name}</div>
                </div>
              </div>
              {viewing.fonction && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Fonction</div>
                  <div style={{ fontSize: 14, color: '#1f2937' }}>{viewing.fonction}</div>
                </div>
              )}
              {viewing.company && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Entreprise</div>
                  <div style={{ fontSize: 14, color: '#1f2937' }}>{viewing.company}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Rôle *</span>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                >
                  <option value="">-- Sélectionner un rôle --</option>
                  <option value="INFI">Infirmier</option>
                  <option value="MED">Médecin</option>
                  <option value="moderator">Modérateur</option>
                  <option value="comptabilite">Comptabilité</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Liaison eBrigade ID</span>
                <input
                  type="text"
                  value={form.liaison_ebrigade_id}
                  onChange={e => setForm({ ...form, liaison_ebrigade_id: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  placeholder="ID de liaison avec eBrigade"
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>NISS</span>
                <input
                  type="text"
                  value={form.niss}
                  onChange={e => setForm({ ...form, niss: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  placeholder="Numéro de sécurité sociale"
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>BCE</span>
                <input
                  type="text"
                  value={form.bce}
                  onChange={e => setForm({ ...form, bce: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  placeholder="Numéro BCE"
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Account</span>
                <input
                  type="text"
                  value={form.account}
                  onChange={e => setForm({ ...form, account: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  placeholder="Numéro de compte"
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => handleValidate(viewing.id)}
                disabled={validating[viewing.id]}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: validating[viewing.id] ? 'not-allowed' : 'pointer',
                  opacity: validating[viewing.id] ? 0.7 : 1
                }}
              >
                ✓ Valider
              </button>
              <button
                onClick={() => handleReject(viewing.id)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✕ Rejeter
              </button>
              <button
                onClick={() => setViewing(null)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
