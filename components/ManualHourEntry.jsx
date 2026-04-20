import React, { useState, useEffect, useRef, useMemo } from 'react'
import styles from './ManualHourEntry.module.css'

const emptyForm = () => ({
  hours_actual: '',
  garde_hours: '',
  sortie_hours: '',
  overtime_hours: '',
  comments: '',
})

function formatDate(d) {
  if (!d) return '-'
  const s = String(d).slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

function userName(u) {
  const fn = u.first_name || u.firstname || ''
  const ln = u.last_name || u.lastname || ''
  return (fn || ln) ? `${fn} ${ln}`.trim() : u.email
}

export default function ManualHourEntry() {
  const [allUsers, setAllUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [cardsError, setCardsError] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)
  const [formData, setFormData] = useState(emptyForm())
  const [modalTypeOverride, setModalTypeOverride] = useState(null) // null=auto, 'garde', 'simple'
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => { if (d) setAllUsers(d.users || []) }).catch(() => {})
  }, [])

  useEffect(() => {
    const handle = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase()
    return allUsers.filter(u => `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase().includes(q)).slice(0, 8)
  }, [allUsers, searchQuery])

  useEffect(() => {
    if (!selectedUser?.email) { setCards([]); return }
    setLoadingCards(true); setCardsError(''); setCards([]); setSelectedCard(null)
    fetch(`/api/activities?email=${encodeURIComponent(selectedUser.email)}&t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setCards(d.activities || []))
      .catch(e => setCardsError(`Erreur chargement cartes (${e})`))
      .finally(() => setLoadingCards(false))
  }, [selectedUser])

  const handleUserSelect = (user) => {
    setSelectedUser(user); setSearchQuery(userName(user)); setShowSuggestions(false)
    setSelectedCard(null); setSaveError(''); setSaveSuccess(''); setFormData(emptyForm())
  }

  const handleClearUser = () => {
    setSelectedUser(null); setSearchQuery(''); setCards([]); setSelectedCard(null)
    setSaveError(''); setSaveSuccess(''); setFormData(emptyForm())
  }

  const handleCardClick = (card) => {
    setSelectedCard(card); setSaveError(''); setSaveSuccess(''); setModalTypeOverride(null)
    setFormData({ hours_actual: card.duration ? String(card.duration) : '', garde_hours: '', sortie_hours: '', overtime_hours: '', comments: '' })
  }

  const handleCloseModal = () => {
    if (saving) return
    setSelectedCard(null); setFormData(emptyForm()); setSaveError(''); setModalTypeOverride(null)
  }

  const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser || !selectedCard) return
    setSaving(true); setSaveError(''); setSaveSuccess('')
    try {
      const ptSubmit = (selectedCard?.pay_type || '').toLowerCase()
      // RMP analytics always use simple layout (heures réelles + sup), not the garde/sortie split
      const isRMPSubmit = (selectedCard?.analytic_name || '').toUpperCase().includes('RMP')
      // Simple: only check pay_type, NOT ebrigade_activity_type (API can set that for Permanence too)
      const isGardeAutoSubmit = !isRMPSubmit && ptSubmit.includes('garde')
      const isGardeSubmit = modalTypeOverride === 'garde' ? true : modalTypeOverride === 'simple' ? false : isGardeAutoSubmit
      console.log('[ManualHourEntry] 🔍 SUBMIT GUARD DETECTION:', { 
        pay_type: selectedCard?.pay_type,
        ptSubmit_lower: ptSubmit,
        isGardeSubmit
      })
      const ebrigadeDurSubmit = selectedCard?.duration ? parseFloat(selectedCard.duration) : null
      const sortieHoursSubmit = formData.sortie_hours !== '' ? parseFloat(formData.sortie_hours) : null
      const gardeHoursSubmit = isGardeSubmit && ebrigadeDurSubmit !== null && sortieHoursSubmit !== null
        ? Math.max(0, ebrigadeDurSubmit - sortieHoursSubmit)
        : (formData.garde_hours ? parseFloat(formData.garde_hours) : null)
      const payload = {
        user_email: selectedUser.email, email: selectedUser.email,
        date: selectedCard.date, pay_type: selectedCard.pay_type || 'Garde',
        hours_actual: isGardeSubmit ? null : (formData.hours_actual ? parseFloat(formData.hours_actual) : null),
        garde_hours: gardeHoursSubmit,
        sortie_hours: sortieHoursSubmit,
        overtime_hours: !isGardeSubmit && formData.overtime_hours ? parseFloat(formData.overtime_hours) : null,
        comments: formData.comments || null,
        analytic_id: selectedCard.analytic_id || null, analytic_name: selectedCard.analytic_name || null,
        ebrigade_id: selectedCard.ebrigade_id || null,
        ebrigade_personnel_id: selectedCard.ebrigade_personnel_id || null,
        ebrigade_personnel_name: selectedCard.ebrigade_personnel_name || null,
        ebrigade_activity_code: selectedCard.ebrigade_activity_code || selectedCard.analytic_code || null,
        ebrigade_activity_name: selectedCard.ebrigade_activity_name || selectedCard.analytic_name || null,
        ebrigade_activity_type: selectedCard.ebrigade_activity_type || null,
        ebrigade_duration_hours: selectedCard.duration || selectedCard.ebrigade_duration_hours || null,
        ebrigade_start_time: selectedCard.startTime || null, ebrigade_end_time: selectedCard.endTime || null,
        status: "En attente d'approbation",
      }
      const res = await fetch('/api/admin/prestations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || `Erreur ${res.status}`) }
      setSaveSuccess(`Heures enregistrees pour ${userName(selectedUser)} - ${formatDate(selectedCard.date)}`)
      setSelectedCard(null); setFormData(emptyForm())
      setLoadingCards(true)
      fetch(`/api/activities?email=${encodeURIComponent(selectedUser.email)}&t=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject()).then(d => setCards(d.activities || [])).catch(() => {}).finally(() => setLoadingCards(false))
      setTimeout(() => setSaveSuccess(''), 5000)
    } catch (err) { setSaveError(err.message || "Erreur lors de l'enregistrement") } finally { setSaving(false) }
  }

  return (
    <>
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 style={{ marginTop: 0 }}>1. Rechercher un utilisateur</h3>
        <div ref={searchRef} style={{ position: 'relative', maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); if (!e.target.value) handleClearUser() }}
              onFocus={() => { if (searchQuery.length >= 2) setShowSuggestions(true) }}
              placeholder="Nom, prenom ou email..." disabled={!!selectedUser}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }}
            />
            {selectedUser && (
              <button onClick={handleClearUser} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Changer
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && !selectedUser && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
              {suggestions.map(u => (
                <button key={u.id} onClick={() => handleUserSelect(u)}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{userName(u)}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedUser && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>👤</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{userName(selectedUser)}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedUser.email}</div>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className={styles.section}>
          <h3>2. Cartes de prestations (vue utilisateur)</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>Cliquez sur une carte pour renseigner les heures.</p>
          {loadingCards && <p style={{ color: '#6b7280', fontSize: 14 }}>Chargement des cartes eBrigade...</p>}
          {cardsError && <p style={{ color: '#dc2626', fontSize: 14 }}>{cardsError}</p>}
          {!loadingCards && !cardsError && cards.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Aucune carte disponible - toutes les heures ont ete declarees ou cet utilisateur n'a pas de liaison eBrigade.</p>
          )}
          {cards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[...cards].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1).map((card) => {
                const isSelected = selectedCard?.id === card.id
                return (
                  <div key={card.id} onClick={() => handleCardClick(card)}
                    style={{ background: isSelected ? '#f5f3ff' : '#fff', border: `2px solid ${isSelected ? '#7c3aed' : '#e5e7eb'}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s', boxShadow: isSelected ? '0 0 0 3px #c4b5fd' : '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#a78bfa'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.12)' } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)' } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>DATE</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#1f2937' }}>
                          {card.date ? new Date(card.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TYPE</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0366d6', background: '#eff6ff', padding: '3px 8px', borderRadius: 6 }}>{card.pay_type || '-'}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>ACTIVITE</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{card.analytic_name || card.ebrigade_activity_name || '-'}</div>
                      {card.startTime && card.endTime && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{card.startTime} - {card.endTime}</div>}
                      {card.duration && <div style={{ fontSize: 12, color: '#6b7280' }}>Duree eBrigade : <strong>{card.duration}h</strong></div>}
                    </div>
                    <div style={{ marginTop: 'auto', padding: '8px 0 0', borderTop: '1px solid #f3f4f6', textAlign: 'center', fontSize: 13, fontWeight: 700, color: isSelected ? '#7c3aed' : '#6b7280' }}>
                      {isSelected ? 'Saisie en cours' : 'Cliquer pour saisir les heures'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {saveSuccess && (
        <div className={styles.section}><div className={styles.success}>{saveSuccess}</div></div>
      )}
    </div>

    {/* Modal saisie heures */}
    {selectedCard && (
      <div
        onClick={handleCloseModal}
        style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'auto', maxHeight: '90vh' }}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>✏️ Déclarer mes heures</h3>
              <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
                {selectedCard.analytic_name || selectedCard.ebrigade_activity_name || '-'} · {selectedCard.date ? new Date(selectedCard.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '-'}
              </div>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={saving}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: 24 }}>
            {/* eBrigade info banner */}
            {selectedCard.duration && (
              <div style={{ marginBottom: 20, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1d4ed8' }}>
                📅 Durée eBrigade : <strong>{selectedCard.duration}h</strong>
                {selectedCard.startTime && <span> · {selectedCard.startTime} – {selectedCard.endTime}</span>}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 16 }}>

                {/* Heures de travail */}
                <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>📊 Heures de travail</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => setModalTypeOverride('garde')}
                        style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid', cursor: 'pointer',
                          background: modalTypeOverride === 'garde' ? '#dc2626' : '#fff',
                          color: modalTypeOverride === 'garde' ? '#fff' : '#6b7280',
                          borderColor: modalTypeOverride === 'garde' ? '#dc2626' : '#d1d5db' }}>
                        Garde
                      </button>
                      <button type="button" onClick={() => setModalTypeOverride('simple')}
                        style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid', cursor: 'pointer',
                          background: modalTypeOverride === 'simple' ? '#7c3aed' : '#fff',
                          color: modalTypeOverride === 'simple' ? '#fff' : '#6b7280',
                          borderColor: modalTypeOverride === 'simple' ? '#7c3aed' : '#d1d5db' }}>
                        Simple
                      </button>
                      {modalTypeOverride !== null && (
                        <button type="button" onClick={() => setModalTypeOverride(null)}
                          style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280' }}>
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const pt = (selectedCard?.pay_type || '').toLowerCase()
                    // RMP analytics always use simple layout (heures réelles + sup), not the garde/sortie split
                    const isRMP = (selectedCard?.analytic_name || '').toUpperCase().includes('RMP')
                    // Simple: only check pay_type, NOT ebrigade_activity_type (API can set that for Permanence too)
                    const isGardeAuto = !isRMP && pt.includes('garde')
                    const isGarde = modalTypeOverride === 'garde' ? true : modalTypeOverride === 'simple' ? false : isGardeAuto
                    const ebrigadeDuration = selectedCard?.duration ? parseFloat(selectedCard.duration) : null
                    const sortieVal = formData.sortie_hours !== '' ? parseFloat(formData.sortie_hours) : null
                    console.log('[ManualHourEntry] 🔍 GARDE DETECTION:', { 
                      pay_type: selectedCard?.pay_type,
                      pt_lower: pt,
                      isGarde,
                      ebrigade_activity_type: selectedCard?.ebrigade_activity_type,
                    })
                    return isGarde ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Read-only: Total hours from eBrigade */}
                        {ebrigadeDuration && (
                          <div style={{ padding: 10, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                            <div style={{ fontSize: 12, color: '#0366d6', fontWeight: 600, marginBottom: 6 }}>📅 HEURES TOTALES (eBrigade)</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0366d6' }}>{ebrigadeDuration}h</div>
                            <div style={{ fontSize: 11, color: '#0366d6', marginTop: 4 }}>
                              Calculé depuis {selectedCard.startTime || '—'} à {selectedCard.endTime || '—'}
                            </div>
                          </div>
                        )}
                        {/* Sortie hours input */}
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>HEURES SORTIE</div>
                          <input type="number" step="0.25" min="0" name="sortie_hours" value={formData.sortie_hours} onChange={handleFormChange} placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
                        </label>
                        {/* Auto-calculated garde hours */}
                        {ebrigadeDuration && sortieVal !== null && (
                          <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                            <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 6 }}>🧮 HEURES GARDE (Calculées)</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{(ebrigadeDuration - sortieVal).toFixed(2)}h</div>
                            <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>= {ebrigadeDuration}h (total) − {sortieVal}h (sortie)</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>HEURES</div>
                          <input type="number" step="0.25" min="0" name="hours_actual" value={formData.hours_actual} onChange={handleFormChange} placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#f97316', fontWeight: 600, marginBottom: 6 }}>HEURES SUPPLÉMENTAIRES</div>
                          <input type="number" step="0.25" min="0" name="overtime_hours" value={formData.overtime_hours} onChange={handleFormChange} placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #fed7aa', fontSize: 14 }} />
                        </label>
                      </div>
                    )
                  })()}
                </div>

                {/* Commentaires */}
                <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
                  <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14, color: '#1f2937' }}>💬 Commentaires</div>
                    <textarea name="comments" rows={3} value={formData.comments} onChange={handleFormChange}
                      placeholder="Ajouter un commentaire..."
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                  </label>
                </div>

              </div>

              {saveError && <div className={styles.error} style={{ marginTop: 12 }}>{saveError}</div>}

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleCloseModal} disabled={saving}
                  style={{ padding: '10px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: '#374151' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? '#9ca3af' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer les heures'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
