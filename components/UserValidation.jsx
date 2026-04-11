import React, { useEffect, useState, useMemo } from 'react'

export default function UserValidation() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [validating, setValidating] = useState({})
  const [filterTab, setFilterTab] = useState('all')
  const [form, setForm] = useState({
    liaison_ebrigade_id: '',
    role: 'INFI',
    niss: '',
    bce: '',
    account: ''
  })

  useEffect(() => { fetchPendingUsers() }, [])

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
    if (!form.role) { alert('Veuillez sélectionner un rôle'); return }
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

  const pending = useMemo(() => users.filter(u => u.onboarding_status === 'pending_signup' || u.onboarding_status === 'pending_validation'), [users])

  function getMissingFields(user) {
    const missing = []
    if (!user.first_name || !user.last_name) missing.push('Prénom/Nom')
    if (!user.telephone) missing.push('Téléphone')
    if (!user.niss && !user.bce) missing.push('NISS ou BCE')
    if (!user.account) missing.push('Compte bancaire')
    return missing
  }

  function getUserCategory(user) {
    if (user.onboarding_status === 'pending_signup') return 'waiting'
    if (getMissingFields(user).length === 0) return 'ready'
    return 'incomplete'
  }

  const counts = useMemo(() => ({
    all: pending.length,
    ready: pending.filter(u => getUserCategory(u) === 'ready').length,
    incomplete: pending.filter(u => getUserCategory(u) === 'incomplete').length,
    waiting: pending.filter(u => getUserCategory(u) === 'waiting').length,
  }), [pending])

  const displayed = useMemo(() => {
    let list = [...pending]
    // Sort: ready first, then incomplete, then waiting
    list.sort((a, b) => {
      const order = { ready: 0, incomplete: 1, waiting: 2 }
      return order[getUserCategory(a)] - order[getUserCategory(b)]
    })
    if (filterTab !== 'all') list = list.filter(u => getUserCategory(u) === filterTab)
    return list
  }, [pending, filterTab])

  const catStyle = {
    ready:      { border: '#10b981', bg: '#f0fdf4', badge: '#d1fae5', badgeText: '#065f46', label: '✓ Prêt à valider' },
    incomplete: { border: '#f59e0b', bg: '#fffbeb', badge: '#fef3c7', badgeText: '#b45309', label: '⚠️ Infos manquantes' },
    waiting:    { border: '#6b7280', bg: '#f9fafb', badge: '#f3f4f6', badgeText: '#374151', label: '📧 Pas encore inscrit' },
  }

  const tabs = [
    { key: 'all',        label: 'Tous',               count: counts.all },
    { key: 'ready',      label: '✓ Prêts à valider',  count: counts.ready },
    { key: 'incomplete', label: '⚠️ Infos manquantes', count: counts.incomplete },
    { key: 'waiting',    label: '📧 Invitation seule', count: counts.waiting },
  ]

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>{counts.ready}</div>
          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>Prêts à valider</div>
        </div>
        <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#b45309' }}>{counts.incomplete}</div>
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>Infos manquantes</div>
        </div>
        <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>{counts.waiting}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Invitation envoyée</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilterTab(t.key)} style={{
            padding: '8px 14px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: filterTab === t.key ? '#fff' : 'transparent',
            color: filterTab === t.key ? '#1d4ed8' : '#6b7280',
            borderBottom: filterTab === t.key ? '2px solid #1d4ed8' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s'
          }}>
            {t.label} <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 10, background: filterTab === t.key ? '#dbeafe' : '#f3f4f6', fontSize: 11 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Aucun utilisateur dans cette catégorie</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(user => {
            const cat = getUserCategory(user)
            const cs = catStyle[cat]
            const missing = cat === 'incomplete' ? getMissingFields(user) : []
            return (
              <div key={user.id} onClick={() => openView(user)} style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: cs.bg, border: `1px solid ${cs.border}33`,
                borderLeft: `4px solid ${cs.border}`,
                borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                transition: 'box-shadow 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ flex: 1, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{user.first_name} {user.last_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: cs.badge, color: cs.badgeText }}>{cs.label}</span>
                    {user.role && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>{user.role}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>📧 {user.email}</span>
                    {user.telephone && <span style={{ fontSize: 12, color: '#6b7280' }}>📞 {user.telephone}</span>}
                    {user.niss && <span style={{ fontSize: 12, color: '#6b7280' }}>🪪 NISS ✓</span>}
                    {user.bce && <span style={{ fontSize: 12, color: '#6b7280' }}>🏢 BCE ✓</span>}
                    {user.account && <span style={{ fontSize: 12, color: '#6b7280' }}>💳 Compte ✓</span>}
                  </div>
                  {missing.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#b45309' }}>
                      Manque : {missing.join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px', fontSize: 18, color: cat === 'ready' ? '#10b981' : '#d1d5db' }}>›</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de validation */}
      {viewing && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{viewing.first_name} {viewing.last_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{viewing.email}</div>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Warning banners */}
              {viewing.onboarding_status === 'pending_signup' && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400e' }}>
                  ⏳ Cet utilisateur n'a pas encore complété son profil. Son invitation est en attente.
                </div>
              )}
              {viewing.onboarding_status === 'pending_validation' && getMissingFields(viewing).length > 0 && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, fontSize: 12, color: '#c2410c' }}>
                  ⚠️ <strong>À compléter avant validation :</strong> {getMissingFields(viewing).join(', ')}
                </div>
              )}

              {/* Infos du profil */}
              {(viewing.telephone || viewing.fonction || viewing.company || viewing.address) && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {viewing.telephone && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Téléphone</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.telephone}</div></div>}
                  {viewing.fonction && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Fonction</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.fonction}</div></div>}
                  {viewing.company && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Entreprise</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.company}</div></div>}
                  {viewing.address && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Adresse</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.address}</div></div>}
                </div>
              )}

              {/* Formulaire admin */}
              <div style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Rôle *</span>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                    <option value="">-- Sélectionner un rôle --</option>
                    <option value="INFI">Infirmier</option>
                    <option value="MED">Médecin</option>
                    <option value="moderator">Modérateur</option>
                    <option value="comptabilite">Comptabilité</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Liaison eBrigade ID</span>
                  <input type="text" value={form.liaison_ebrigade_id} onChange={e => setForm({ ...form, liaison_ebrigade_id: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} placeholder="ID de liaison avec eBrigade" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>NISS</span>
                    <input type="text" value={form.niss} onChange={e => setForm({ ...form, niss: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.niss ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="Numéro NISS" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>BCE</span>
                    <input type="text" value={form.bce} onChange={e => setForm({ ...form, bce: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.bce ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="Numéro BCE" />
                  </label>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Compte bancaire</span>
                  <input type="text" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.account ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="BE00 0000 0000 0000" />
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <button onClick={() => handleValidate(viewing.id)} disabled={validating[viewing.id]} style={{
                  flex: 1, padding: '12px 16px', background: validating[viewing.id] ? '#6ee7b7' : '#10b981',
                  color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 14,
                  cursor: validating[viewing.id] ? 'not-allowed' : 'pointer'
                }}>
                  {validating[viewing.id] ? '⏳ Validation…' : '✓ Valider le compte'}
                </button>
                <button onClick={() => handleReject(viewing.id)} style={{
                  padding: '12px 16px', background: '#fee2e2', color: '#991b1b',
                  border: '1px solid #fca5a5', borderRadius: 6, fontWeight: 600, cursor: 'pointer'
                }}>
                  ✕ Rejeter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
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

  const pending = useMemo(() => users.filter(u => u.onboarding_status === 'pending_signup' || u.onboarding_status === 'pending_validation'), [users])

  function getMissingFields(user) {
    const missing = []
    if (!user.first_name || !user.last_name) missing.push('Prénom/Nom')
    if (!user.telephone) missing.push('Téléphone')
    if (!user.niss && !user.bce) missing.push('NISS ou BCE')
    if (!user.account) missing.push('Compte bancaire')
    return missing
  }

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
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{user.first_name} {user.last_name}</div>
                    {(() => {
                      if (user.onboarding_status === 'pending_signup') return <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>📧 Attente inscription</span>
                      const missing = getMissingFields(user)
                      return missing.length === 0
                        ? <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>✓ Profil complété</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>⚠️ Infos manquantes</span>
                    })()}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{user.email}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Rôle: <strong>{user.role || 'Non défini'}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Cliquez →</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de validation */}
      {viewing && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>✅ Valider: {viewing.first_name} {viewing.last_name}</h2>
              {(() => {
                if (viewing.onboarding_status === 'pending_signup') return <span style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>📧 Invitation envoyée</span>
                const missing = getMissingFields(viewing)
                return missing.length === 0
                  ? <span style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 4, background: '#d1fae5', color: '#065f46' }}>✓ Profil complété</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>⚠️ {missing.join(', ')} manquant(s)</span>
              })()}
            </div>

            {viewing.onboarding_status === 'pending_signup' && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                ⏳ Cet utilisateur n'a pas encore complété son profil. Son invitation est en attente.
              </div>
            )}
            {viewing.onboarding_status === 'pending_validation' && getMissingFields(viewing).length > 0 && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#c2410c' }}>
                ⚠️ <strong>Infos manquantes à renseigner avant validation :</strong> {getMissingFields(viewing).join(', ')}
              </div>
            )}

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
