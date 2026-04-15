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
    setSelectedCard(card); setSaveError(''); setSaveSuccess('')
    setFormData({ hours_actual: card.duration ? String(card.duration) : '', garde_hours: '', sortie_hours: '', overtime_hours: '', comments: '' })
    setTimeout(() => document.getElementById('mhe-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser || !selectedCard) return
    setSaving(true); setSaveError(''); setSaveSuccess('')
    try {
      const payload = {
        user_email: selectedUser.email, email: selectedUser.email,
        date: selectedCard.date, pay_type: selectedCard.pay_type || 'Garde',
        hours_actual: formData.hours_actual ? parseFloat(formData.hours_actual) : null,
        garde_hours: formData.garde_hours ? parseFloat(formData.garde_hours) : null,
        sortie_hours: formData.sortie_hours ? parseFloat(formData.sortie_hours) : null,
        overtime_hours: formData.overtime_hours ? parseFloat(formData.overtime_hours) : null,
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

      {selectedCard && (
        <div className={styles.section} id="mhe-form">
          <h3>3. Saisir les heures - <span style={{ color: '#7c3aed' }}>{selectedCard.analytic_name || selectedCard.ebrigade_activity_name} · {formatDate(selectedCard.date)}</span></h3>
          {selectedCard.duration && (
            <div style={{ marginBottom: 16, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1d4ed8' }}>
              Duree eBrigade : <strong>{selectedCard.duration}h</strong>{selectedCard.startTime && ` · ${selectedCard.startTime} - ${selectedCard.endTime}`}
            </div>
          )}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="hours_actual">Heures reelles :</label>
                <input id="hours_actual" type="number" step="0.25" min="0" name="hours_actual" value={formData.hours_actual} onChange={handleFormChange} placeholder="0" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="garde_hours">Heures de garde :</label>
                <input id="garde_hours" type="number" step="0.25" min="0" name="garde_hours" value={formData.garde_hours} onChange={handleFormChange} placeholder="0" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="sortie_hours">Heures de sortie :</label>
                <input id="sortie_hours" type="number" step="0.25" min="0" name="sortie_hours" value={formData.sortie_hours} onChange={handleFormChange} placeholder="0" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="overtime_hours">Heures supplementaires :</label>
                <input id="overtime_hours" type="number" step="0.25" min="0" name="overtime_hours" value={formData.overtime_hours} onChange={handleFormChange} placeholder="0" />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="comments">Commentaires :</label>
                <textarea id="comments" name="comments" rows="3" value={formData.comments} onChange={handleFormChange} placeholder="Ajouter des notes..." />
              </div>
            </div>
            {saveError && <div className={styles.error}>{saveError}</div>}
            {saveSuccess && <div className={styles.success}>{saveSuccess}</div>}
            <div className={styles.buttonGroup}>
              <button type="submit" disabled={saving} className={styles.submitBtn}>{saving ? 'Enregistrement...' : 'Enregistrer les heures'}</button>
              <button type="button" onClick={() => { setSelectedCard(null); setFormData(emptyForm()) }} disabled={saving} className={styles.cancelBtn}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {saveSuccess && !selectedCard && (
        <div className={styles.section}><div className={styles.success}>{saveSuccess}</div></div>
      )}
    </div>
  )
}
