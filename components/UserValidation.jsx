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
    if (!form.role) { alert('Veuillez s\u00e9lectionner un r\u00f4le'); return }
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
      alert('Utilisateur valid\u00e9 et activ\u00e9 avec succ\u00e8s !')
    } catch (e) {
      console.error('validate failed', e)
      alert(`Erreur: ${e.message}`)
    } finally {
      setValidating(prev => { const c = { ...prev }; delete c[userId]; return c })
    }
  }

  async function handleReject(userId) {
    if (!confirm('Rejeter cet utilisateur ? Son compte sera supprim\u00e9.')) return
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

  const pending = useMemo(() => users.filter(u =>
    u.onboarding_status === 'pending_signup' || u.onboarding_status === 'pending_validation'
  ), [users])

  function getMissingFields(user) {
    const missing = []
    if (!user.first_name || !user.last_name) missing.push('Pr\u00e9nom/Nom')
    const needsFinancialInfo = user.role === 'INFI' || user.role === 'MED'
    if (needsFinancialInfo) {
      if (!user.telephone) missing.push('T\u00e9l\u00e9phone')
      if (!user.niss && !user.bce) missing.push('NISS ou BCE')
      if (!user.account) missing.push('Compte bancaire')
    }
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
    list.sort((a, b) => {
      const order = { ready: 0, incomplete: 1, waiting: 2 }
      return order[getUserCategory(a)] - order[getUserCategory(b)]
    })
    if (filterTab !== 'all') list = list.filter(u => getUserCategory(u) === filterTab)
    return list
  }, [pending, filterTab])

  const catStyle = {
    ready:      { border: '#10b981', bg: '#f0fdf4', badge: '#d1fae5', badgeText: '#065f46', label: 'Pr\u00eat \u00e0 valider' },
    incomplete: { border: '#f59e0b', bg: '#fffbeb', badge: '#fef3c7', badgeText: '#b45309', label: 'Infos manquantes' },
    waiting:    { border: '#6b7280', bg: '#f9fafb', badge: '#f3f4f6', badgeText: '#374151', label: 'Invitation en attente' },
  }

  const tabs = [
    { key: 'all',        label: 'Tous',                    count: counts.all },
    { key: 'ready',      label: 'Pr\u00eats \u00e0 valider', count: counts.ready },
    { key: 'incomplete', label: 'Infos manquantes',         count: counts.incomplete },
    { key: 'waiting',    label: 'Invitation seule',         count: counts.waiting },
  ]

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Chargement...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>{counts.ready}</div>
          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>Pr\u00eats \u00e0 valider</div>
        </div>
        <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#b45309' }}>{counts.incomplete}</div>
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>Infos manquantes</div>
        </div>
        <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>{counts.waiting}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Invitation envoy\u00e9e</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #e5e7eb' }}>
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
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Aucun utilisateur dans cette cat\u00e9gorie</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(user => {
            const cat = getUserCategory(user)
            const cs = catStyle[cat]
            const missing = cat === 'incomplete' ? getMissingFields(user) : []
            return (
              <div key={user.id} onClick={() => openView(user)} style={{
                display: 'flex', alignItems: 'center',
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
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</span>
                    {user.telephone && <span style={{ fontSize: 12, color: '#6b7280' }}>Tel: {user.telephone}</span>}
                    {user.niss && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>NISS ok</span>}
                    {user.bce && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>BCE ok</span>}
                    {user.account && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Compte ok</span>}
                  </div>
                  {missing.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                      Manque : {missing.join(' / ')}
                    </div>
                  )}
                </div>
                <div style={{ padding: '0 16px', fontSize: 22, color: cat === 'ready' ? '#10b981' : '#d1d5db', fontWeight: 300 }}>{'>'}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de validation */}
      {viewing && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{viewing.first_name} {viewing.last_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{viewing.email}</div>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: '4px 8px' }}>x</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {viewing.onboarding_status === 'pending_signup' && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400e' }}>
                  Cet utilisateur n&apos;a pas encore compl\u00e9t\u00e9 son profil. Son invitation est en attente.
                </div>
              )}
              {viewing.onboarding_status === 'pending_validation' && getMissingFields(viewing).length > 0 && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, fontSize: 12, color: '#c2410c' }}>
                  <strong>A compl\u00e9ter avant validation :</strong> {getMissingFields(viewing).join(', ')}
                </div>
              )}

              {(viewing.telephone || viewing.fonction || viewing.company || viewing.address) && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {viewing.telephone && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>T\u00e9l\u00e9phone</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.telephone}</div></div>}
                  {viewing.fonction && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Fonction</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.fonction}</div></div>}
                  {viewing.company && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Entreprise</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.company}</div></div>}
                  {viewing.address && <div><div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Adresse</div><div style={{ fontSize: 13, color: '#1f2937' }}>{viewing.address}</div></div>}
                </div>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>R\u00f4le *</span>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                    <option value="">-- S\u00e9lectionner un r\u00f4le --</option>
                    <option value="INFI">Infirmier</option>
                    <option value="MED">M\u00e9decin</option>
                    <option value="moderator">Mod\u00e9rateur</option>
                    <option value="comptabilite">Comptabilit\u00e9</option>
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
                    <input type="text" value={form.niss} onChange={e => setForm({ ...form, niss: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.niss ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="Num\u00e9ro NISS" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>BCE</span>
                    <input type="text" value={form.bce} onChange={e => setForm({ ...form, bce: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.bce ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="Num\u00e9ro BCE" />
                  </label>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Compte bancaire</span>
                  <input type="text" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} style={{ padding: '9px 12px', border: `1px solid ${form.account ? '#10b981' : '#d1d5db'}`, borderRadius: 6, fontSize: 14 }} placeholder="BE00 0000 0000 0000" />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <button onClick={() => handleValidate(viewing.id)} disabled={validating[viewing.id]} style={{
                  flex: 1, padding: '12px 16px', background: validating[viewing.id] ? '#6ee7b7' : '#10b981',
                  color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 14,
                  cursor: validating[viewing.id] ? 'not-allowed' : 'pointer'
                }}>
                  {validating[viewing.id] ? 'Validation...' : 'Valider le compte'}
                </button>
                <button onClick={() => handleReject(viewing.id)} style={{
                  padding: '12px 16px', background: '#fee2e2', color: '#991b1b',
                  border: '1px solid #fca5a5', borderRadius: 6, fontWeight: 600, cursor: 'pointer'
                }}>
                  Rejeter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

