import React, { useState, useEffect, useRef, useMemo } from 'react'
import styles from './ManualHourEntry.module.css'

const emptyForm = () => ({
  hours_actual: '',
  garde_hours: '',
  sortie_hours: '',
  overtime_hours: '',
  comments: '',
  expenses: [],
  travel_zone: '',
})

const APS_TRAVEL_ZONES = [
  { value: '', label: '— Sélectionner une zone —', amount: null },
  { value: 'brabant_wallon', label: 'Brabant Wallon', amount: 30 },
  { value: 'liege_hainaut_namur', label: 'Liège / Hainaut / Namur', amount: 60 },
  { value: 'luxembourg', label: 'Luxembourg', amount: 100 },
]

function parseTimeToMinutes(value) {
  if (!value) return null
  const s = String(value).trim().toLowerCase()
  const m = s.match(/(\d{1,2})(?:[:h](\d{2}))?/) 
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] || 0)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return (h * 60) + min
}

function resolveCardDurationHours(card) {
  const start = parseTimeToMinutes(card?.startTime)
  const end = parseTimeToMinutes(card?.endTime)
  if (start != null && end != null) {
    const delta = end >= start ? (end - start) : ((end + 24 * 60) - start)
    if (delta > 0) return Math.round(((delta / 60) + Number.EPSILON) * 100) / 100
  }
  const parsed = Number(String(card?.duration ?? card?.ebrigade_duration_hours ?? '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

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
  const ribFileRef = useRef(null)
  const [ribStatus, setRibStatus] = useState(null) // null | 'none' | 'pending' | 'approved' | 'rejected'
  const [ribUploading, setRibUploading] = useState(false)
  const [ribError, setRibError] = useState('')
  const [ribSuccess, setRibSuccess] = useState('')

  // pharmacien direct session state
  const [pharmDate, setPharmDate] = useState('')
  const [pharmHours, setPharmHours] = useState('')
  const [pharmComment, setPharmComment] = useState('')
  const [pharmAnalyticId, setPharmAnalyticId] = useState('')
  const [pharmAnalyticName, setPharmAnalyticName] = useState('')
  const [pharmSaving, setPharmSaving] = useState(false)
  const [pharmError, setPharmError] = useState('')
  const [pharmSuccess, setPharmSuccess] = useState('')
  const [analytics, setAnalytics] = useState([])

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.ok ? r.json() : null).then(d => { if (d) setAnalytics((d.analytics || []).filter(a => a.is_active !== false)) }).catch(() => {})
  }, [])

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
    setRibStatus(null); setRibError(''); setRibSuccess('')
    fetch('/api/documents?email=' + encodeURIComponent(user.email))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const docs = (d && d.documents) || []
        const rib = docs[0] || null
        setRibStatus(rib ? (rib.validation_status || 'pending') : 'none')
      })
      .catch(() => setRibStatus('none'))
  }

  const handleClearUser = () => {
    setSelectedUser(null); setSearchQuery(''); setCards([]); setSelectedCard(null)
    setSaveError(''); setSaveSuccess(''); setFormData(emptyForm())
    setRibStatus(null); setRibError(''); setRibSuccess('')
  }

  const handleRibUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setRibError('Veuillez sélectionner un fichier PDF'); return }
    if (file.size > 5 * 1024 * 1024) { setRibError('Le fichier ne doit pas dépasser 5 MB'); return }
    setRibUploading(true); setRibError(''); setRibSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('email', selectedUser.email)
      fd.append('documentType', 'RIB')
      const r = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Erreur ${r.status}`) }
      setRibStatus('pending')
      setRibSuccess(`RIB uploadé pour ${userName(selectedUser)} — en attente de validation`)
      if (ribFileRef.current) ribFileRef.current.value = ''
      setTimeout(() => setRibSuccess(''), 6000)
    } catch (err) {
      setRibError(err.message || 'Erreur lors de l\'upload')
    } finally {
      setRibUploading(false)
    }
  }

  const handleCardClick = (card) => {
    setSelectedCard(card); setSaveError(''); setSaveSuccess('')
    // Use activity-level configured type if set, otherwise auto
    const activityType = card.hour_entry_type === 'garde' || card.hour_entry_type === 'simple' ? card.hour_entry_type : null
    setModalTypeOverride(activityType)
    const resolvedDuration = resolveCardDurationHours(card)
    setFormData({ hours_actual: resolvedDuration ? String(resolvedDuration) : '', garde_hours: '', sortie_hours: '', overtime_hours: '', comments: '', expenses: [], travel_zone: '' })
  }

  const handlePharmacienSubmit = async (e) => {
    e.preventDefault()
    if (!pharmDate) { setPharmError('Veuillez sélectionner une date.'); return }
    if (!pharmHours || Number(pharmHours) <= 0) { setPharmError("Veuillez entrer un nombre d'heures valide."); return }
    setPharmSaving(true); setPharmError(''); setPharmSuccess('')
    try {
      const selectedAnalytic = analytics.find(a => String(a.id) === String(pharmAnalyticId))
      const payload = {
        user_email: selectedUser.email, email: selectedUser.email,
        date: pharmDate,
        pay_type: 'Pharmacien',
        hours_actual: parseFloat(pharmHours),
        comments: pharmComment || null,
        analytic_id: selectedAnalytic ? selectedAnalytic.id : null,
        analytic_name: selectedAnalytic ? selectedAnalytic.name : null,
        status: "Validé",
        is_admin_override: true,
      }
      const res = await fetch('/api/admin/prestations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Erreur ${res.status}`) }
      setPharmSuccess(`Session enregistrée pour ${userName(selectedUser)} - ${formatDate(pharmDate)}`)
      setPharmDate(''); setPharmHours(''); setPharmComment(''); setPharmAnalyticId(''); setPharmAnalyticName('')
      setTimeout(() => setPharmSuccess(''), 5000)
    } catch (err) { setPharmError(err.message || "Erreur lors de l'enregistrement") } finally { setPharmSaving(false) }
  }

  const handleCloseModal = () => {
    if (saving) return
    setSelectedCard(null); setFormData(emptyForm()); setSaveError(''); setModalTypeOverride(null)
  }

  const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser || !selectedCard) return
    // Validate expenses before saving
    const expenses = formData.expenses || []
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i]
      if (Number(exp.amount || 0) > 0) {
        if (!exp.comment?.trim()) { setSaveError(`Note de frais #${i + 1} : veuillez renseigner une raison.`); return }
        if (!exp.proof_image && !exp.is_travel_zone) { setSaveError(`Note de frais #${i + 1} : veuillez joindre une pièce justificative.`); return }
      }
    }

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
      const ebrigadeDurSubmit = resolveCardDurationHours(selectedCard)
      const rawSortieHoursSubmit = formData.sortie_hours !== '' ? parseFloat(formData.sortie_hours) : null
      const sortieHoursSubmit = isGardeSubmit && ebrigadeDurSubmit !== null && rawSortieHoursSubmit !== null
        ? Math.min(rawSortieHoursSubmit, ebrigadeDurSubmit)
        : rawSortieHoursSubmit
      const rawHoursActualSubmit = formData.hours_actual ? parseFloat(formData.hours_actual) : null
      const hoursActualSubmit = !isGardeSubmit && ebrigadeDurSubmit !== null && rawHoursActualSubmit !== null
        ? Math.min(rawHoursActualSubmit, ebrigadeDurSubmit)
        : rawHoursActualSubmit
      const simpleExcessSubmit = !isGardeSubmit && ebrigadeDurSubmit !== null && rawHoursActualSubmit !== null && rawHoursActualSubmit > ebrigadeDurSubmit
        ? Math.round((rawHoursActualSubmit - ebrigadeDurSubmit) * 100) / 100 : 0
      const gardeHoursSubmit = isGardeSubmit && ebrigadeDurSubmit !== null && sortieHoursSubmit !== null
        ? Math.max(0, ebrigadeDurSubmit - sortieHoursSubmit)
        : (formData.garde_hours ? parseFloat(formData.garde_hours) : null)
      // If sortie > ebrigade duration, the excess becomes overtime
      const gardeExcessSubmit = isGardeSubmit && ebrigadeDurSubmit !== null && rawSortieHoursSubmit !== null && rawSortieHoursSubmit > ebrigadeDurSubmit
        ? Math.round((rawSortieHoursSubmit - ebrigadeDurSubmit) * 100) / 100 : 0
      const baseOvertimeSubmit = formData.overtime_hours ? parseFloat(formData.overtime_hours) : 0
      const overtimeHoursSubmit = isGardeSubmit
        ? (gardeExcessSubmit > 0 ? gardeExcessSubmit : null)
        : ((baseOvertimeSubmit + simpleExcessSubmit) > 0 ? Math.round((baseOvertimeSubmit + simpleExcessSubmit) * 100) / 100 : null)
      const payload = {
        user_email: selectedUser.email, email: selectedUser.email,
        date: selectedCard.date, pay_type: selectedCard.pay_type || 'Garde',
        hours_actual: isGardeSubmit ? null : hoursActualSubmit,
        garde_hours: gardeHoursSubmit,
        sortie_hours: sortieHoursSubmit,
        overtime_hours: overtimeHoursSubmit,
        comments: formData.comments || null,
        travel_zone: formData.travel_zone || null,
        expenses_json: formData.expenses && formData.expenses.filter(e => Number(e.amount || 0) > 0).length > 0 ? JSON.stringify(formData.expenses.filter(e => Number(e.amount || 0) > 0)) : null,
        analytic_id: selectedCard.analytic_id || null, analytic_name: selectedCard.analytic_name || null,
        ebrigade_id: selectedCard.ebrigade_id || null,
        ebrigade_personnel_id: selectedCard.ebrigade_personnel_id || null,
        ebrigade_personnel_name: selectedCard.ebrigade_personnel_name || null,
        ebrigade_activity_code: selectedCard.ebrigade_activity_code || selectedCard.analytic_code || null,
        ebrigade_activity_name: selectedCard.ebrigade_activity_name || selectedCard.analytic_name || null,
        ebrigade_activity_type: selectedCard.ebrigade_activity_type || null,
        ebrigade_duration_hours: resolveCardDurationHours(selectedCard),
        ebrigade_start_time: selectedCard.startTime || null, ebrigade_end_time: selectedCard.endTime || null,
        status: "En attente d'approbation",
        is_admin_override: true,
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

      {/* Section spécifique Pharmacien */}
      {selectedUser && (() => {
        const userRole = selectedUser.role || ''
        const roles = Array.isArray(userRole) ? userRole : String(userRole).split(',').map(s => s.trim())
        return roles.includes('pharmacien')
      })() && (
        <div className={styles.section}>
          <h3 style={{ color: '#7e22ce' }}>💊 2. Saisie des heures — Pharmacien</h3>
          <div style={{ padding: '12px 16px', background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#7e22ce' }}>
            Forfait <strong>400€ / demi-mois</strong> — Les heures saisies ici sont enregistrées pour le suivi du temps. La facturation se fait à raison d'un forfait de 400€ par période de 15 jours.
          </div>
          <form onSubmit={handlePharmacienSubmit} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>DATE *</div>
                <input type="date" value={pharmDate} onChange={e => setPharmDate(e.target.value)} required
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>HEURES TRAVAILLÉES *</div>
                <input type="number" step="0.25" min="0.25" max="24" value={pharmHours} onChange={e => setPharmHours(e.target.value)}
                  placeholder="ex: 8" required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
              </label>
            </div>
            <label>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>ANALYTIQUE *</div>
              <select value={pharmAnalyticId} onChange={e => setPharmAnalyticId(e.target.value)} required
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                <option value=''>— Sélectionner un analytique —</option>
                {analytics.map(a => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>COMMENTAIRE (optionnel)</div>
              <input type="text" value={pharmComment} onChange={e => setPharmComment(e.target.value)}
                placeholder="Remarques éventuelles..."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
            </label>
            {pharmError && <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>{pharmError}</div>}
            {pharmSuccess && <div style={{ padding: '8px 12px', background: '#d1fae5', color: '#065f46', borderRadius: 6, fontSize: 13 }}>{pharmSuccess}</div>}
            <div>
              <button type="submit" disabled={pharmSaving}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: pharmSaving ? '#9ca3af' : '#7e22ce', color: 'white', fontWeight: 700, fontSize: 14, cursor: pharmSaving ? 'not-allowed' : 'pointer' }}>
                {pharmSaving ? '⏳ Enregistrement...' : '✅ Enregistrer la session'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                      {resolveCardDurationHours(card) && <div style={{ fontSize: 12, color: '#6b7280' }}>Duree eBrigade : <strong>{resolveCardDurationHours(card)}h</strong></div>}
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

      {/* Section RIB */}
      {selectedUser && (
        <div className={styles.section}>
          <h3>3. RIB de l'utilisateur</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
            Uploadez un RIB PDF pour cet utilisateur — il entrera dans le flux de validation admin.
          </p>

          {/* Statut actuel */}
          {ribStatus === 'approved' && (
            <div style={{ padding: '10px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#065f46' }}>
              <span style={{ fontSize: 18 }}>✅</span> RIB validé
            </div>
          )}
          {ribStatus === 'pending' && (
            <div style={{ padding: '10px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#92400e' }}>
              <span style={{ fontSize: 18 }}>⏳</span> RIB en attente de validation
            </div>
          )}
          {ribStatus === 'rejected' && (
            <div style={{ padding: '10px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#991b1b' }}>
              <span style={{ fontSize: 18 }}>❌</span> RIB rejeté — vous pouvez en soumettre un nouveau
            </div>
          )}
          {ribStatus === 'none' && (
            <div style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#374151' }}>
              <span style={{ fontSize: 18 }}>📄</span> Aucun RIB soumis
            </div>
          )}

          {/* Upload */}
          {ribStatus !== 'approved' && ribStatus !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <input
                ref={ribFileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleRibUpload}
                disabled={ribUploading}
                style={{ fontSize: 13 }}
              />
              {ribUploading && <span style={{ fontSize: 13, color: '#6b7280' }}>Upload en cours…</span>}
            </div>
          )}

          {ribError && <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{ribError}</div>}
          {ribSuccess && <div style={{ marginTop: 8, fontSize: 13, color: '#059669', fontWeight: 600 }}>{ribSuccess}</div>}
        </div>
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
            {resolveCardDurationHours(selectedCard) && (
              <div style={{ marginBottom: 20, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1d4ed8' }}>
                📅 Durée eBrigade : <strong>{resolveCardDurationHours(selectedCard)}h</strong>
                {selectedCard.startTime && <span> · {selectedCard.startTime} – {selectedCard.endTime}</span>}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 16 }}>

                {/* Heures de travail */}
                <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>📊 Heures de travail</div>
                    <select value={modalTypeOverride || 'auto'} onChange={e => setModalTypeOverride(e.target.value === 'auto' ? null : e.target.value)}
                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                      <option value="auto">Auto</option>
                      <option value="garde">Garde</option>
                      <option value="simple">Simple</option>
                    </select>
                  </div>
                  {(() => {
                    const pt = (selectedCard?.pay_type || '').toLowerCase()
                    // RMP analytics always use simple layout (heures réelles + sup), not the garde/sortie split
                    const isRMP = (selectedCard?.analytic_name || '').toUpperCase().includes('RMP')
                    // Simple: only check pay_type, NOT ebrigade_activity_type (API can set that for Permanence too)
                    const isGardeAuto = !isRMP && pt.includes('garde')
                    const isGarde = modalTypeOverride === 'garde' ? true : modalTypeOverride === 'simple' ? false : isGardeAuto
                    const ebrigadeDuration = resolveCardDurationHours(selectedCard)
                    const sortieVal = formData.sortie_hours !== '' ? parseFloat(formData.sortie_hours) : null
                    const simpleHoursVal = formData.hours_actual !== '' ? parseFloat(formData.hours_actual) : null
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
                          sortieVal <= ebrigadeDuration ? (
                            <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                              <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 6 }}>🧮 HEURES GARDE (Calculées)</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{(ebrigadeDuration - sortieVal).toFixed(2)}h</div>
                              <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>= {ebrigadeDuration}h (total) − {sortieVal}h (sortie)</div>
                            </div>
                          ) : (
                            <div style={{ padding: 10, background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
                              <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 600, marginBottom: 6 }}>⚠️ HEURES SUP (Auto)</div>
                              <div style={{ fontSize: 13, color: '#c2410c' }}>Sortie: {ebrigadeDuration.toFixed(2)}h</div>
                              <div style={{ fontSize: 13, color: '#c2410c' }}>Garde: 0h</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#f97316', marginTop: 4 }}>Supp: +{(sortieVal - ebrigadeDuration).toFixed(2)}h</div>
                              <div style={{ fontSize: 11, color: '#c2410c', marginTop: 2 }}>{sortieVal.toFixed(2)}h saisi = {ebrigadeDuration.toFixed(2)}h sortie + {(sortieVal - ebrigadeDuration).toFixed(2)}h sup</div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>HEURES RÉELLES</div>
                          <input type="number" step="0.25" min="0" name="hours_actual" value={formData.hours_actual} onChange={handleFormChange} placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#f97316', fontWeight: 600, marginBottom: 6 }}>HEURES SUPPLÉMENTAIRES (manuel + auto)</div>
                          <input type="number" step="0.25" min="0" name="overtime_hours" value={formData.overtime_hours} onChange={handleFormChange} placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #fed7aa', fontSize: 14 }} />
                        </label>
                        {ebrigadeDuration && simpleHoursVal !== null && simpleHoursVal > ebrigadeDuration && (
                          <div style={{ gridColumn: '1 / -1', padding: 10, background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
                            <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 600, marginBottom: 6 }}>⚠️ HEURES SUP (Auto)</div>
                            <div style={{ fontSize: 13, color: '#c2410c' }}>Heures réelles retenues: {ebrigadeDuration.toFixed(2)}h</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#f97316', marginTop: 4 }}>Supp auto: +{(simpleHoursVal - ebrigadeDuration).toFixed(2)}h</div>
                            <div style={{ fontSize: 11, color: '#c2410c', marginTop: 2 }}>{simpleHoursVal.toFixed(2)}h saisi = {ebrigadeDuration.toFixed(2)}h réelles + {(simpleHoursVal - ebrigadeDuration).toFixed(2)}h sup</div>
                          </div>
                        )}
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

                {/* Forfait déplacement APS */}
                {((selectedCard?.pay_type || '').toLowerCase().includes('aps') || (selectedCard?.ebrigade_activity_name || selectedCard?.analytic_name || '').toLowerCase().includes('aps')) && (
                  <div style={{ padding: 12, border: '1px solid #3b82f6', borderRadius: 8, background: '#eff6ff' }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: '#1e40af' }}>🚗 Forfait déplacement</div>
                    <select
                      value={formData.travel_zone || ''}
                      onChange={e => {
                        const zoneValue = e.target.value
                        const zone = APS_TRAVEL_ZONES.find(z => z.value === zoneValue)
                        const otherExpenses = (formData.expenses || []).filter(ex => !ex.is_travel_zone)
                        let newExpenses = otherExpenses
                        if (zone && zone.amount > 0) {
                          newExpenses = [
                            { amount: zone.amount, comment: `Forfait déplacement - ${zone.label}`, proof_image: null, is_travel_zone: true },
                            ...otherExpenses
                          ]
                        }
                        setFormData(prev => ({ ...prev, travel_zone: zoneValue, expenses: newExpenses }))
                      }}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #93c5fd', fontSize: 15, background: '#fff', color: '#1e3a8a', fontWeight: 500 }}
                    >
                      {APS_TRAVEL_ZONES.map(z => (
                        <option key={z.value} value={z.value}>
                          {z.label}{z.amount != null && z.value ? ` — ${z.amount} €` : ''}
                        </option>
                      ))}
                    </select>
                    {formData.travel_zone && (() => {
                      const z = APS_TRAVEL_ZONES.find(x => x.value === formData.travel_zone)
                      if (!z || z.amount === null) return null
                      return <div style={{ marginTop: 8, fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>✅ Forfait déplacement ajouté : {z.amount} €</div>
                    })()}
                  </div>
                )}

                {/* Notes de frais */}
                <div style={{ padding: 12, border: '1px solid #f59e0b', borderRadius: 8, background: '#fffbeb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>🧾 Notes de frais (si applicable)</div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, expenses: [...(prev.expenses || []), { amount: '', comment: '', proof_image: null }] }))}
                      style={{ padding: '5px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                    >+ Ajouter une note</button>
                  </div>

                  {(!formData.expenses || formData.expenses.filter(e => !e.is_travel_zone).length === 0) && (
                    <div style={{ fontSize: 13, color: '#b45309', fontStyle: 'italic' }}>Aucune note de frais. Cliquez sur « + Ajouter une note » si nécessaire.</div>
                  )}

                  {(formData.expenses || []).map((exp, idx) => exp.is_travel_zone ? null : (
                    <div key={idx} style={{ padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #fcd34d', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Note #{idx + 1}</div>
                        {!exp.is_travel_zone && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, expenses: (prev.expenses || []).filter((_, i) => i !== idx) }))}
                          style={{ padding: '3px 8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >✕ Supprimer</button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>MONTANT (€)</div>
                          <input
                            type="number" step="0.01" min="0"
                            value={exp.amount ?? ''}
                            readOnly={!!exp.is_travel_zone}
                            onChange={exp.is_travel_zone ? undefined : e => setFormData(prev => ({ ...prev, expenses: (prev.expenses || []).map((x, i) => i === idx ? { ...x, amount: e.target.value ? Number(e.target.value) : '' } : x) }))}
                            style={{ padding: '7px 9px', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 14, background: exp.is_travel_zone ? '#f0f9ff' : '', color: exp.is_travel_zone ? '#1e40af' : '', cursor: exp.is_travel_zone ? 'not-allowed' : '' }}
                            placeholder="0.00"
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>RAISON / COMMENTAIRE {Number(exp.amount || 0) > 0 && !exp.is_travel_zone && <span style={{ color: '#dc2626' }}>*</span>}</div>
                          <input
                            value={exp.comment || ''}
                            readOnly={!!exp.is_travel_zone}
                            onChange={exp.is_travel_zone ? undefined : e => setFormData(prev => ({ ...prev, expenses: (prev.expenses || []).map((x, i) => i === idx ? { ...x, comment: e.target.value } : x) }))}
                            style={{ padding: '7px 9px', borderRadius: 6, border: !exp.is_travel_zone && Number(exp.amount || 0) > 0 && !exp.comment?.trim() ? '1px solid #dc2626' : '1px solid #fcd34d', fontSize: 14, background: exp.is_travel_zone ? '#f0f9ff' : '', color: exp.is_travel_zone ? '#1e40af' : '', cursor: exp.is_travel_zone ? 'not-allowed' : '' }}
                            placeholder="Ex: Transport, fournitures..."
                          />
                          {Number(exp.amount || 0) > 0 && !exp.comment?.trim() && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>Obligatoire</div>}
                        </label>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12, color: '#92400e' }}>📸 JUSTIFICATIF {Number(exp.amount || 0) > 0 && <span style={{ color: '#dc2626' }}>*</span>}</div>
                        {!exp.proof_image && (
                          <input type="file" accept="image/*,application/pdf" style={{ fontSize: 13 }} onChange={async (e) => {
                            const f = e.target.files && e.target.files[0]
                            if (!f) return
                            const data = await new Promise((res, rej) => {
                              const reader = new FileReader()
                              reader.onload = () => res(reader.result)
                              reader.onerror = rej
                              reader.readAsDataURL(f)
                            })
                            setFormData(prev => ({ ...prev, expenses: (prev.expenses || []).map((x, i) => i === idx ? { ...x, proof_image: data, proof_name: f.name } : x) }))
                          }} />
                        )}
                        {Number(exp.amount || 0) > 0 && !exp.proof_image && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>Obligatoire si montant renseigné</div>}
                        {exp.proof_image && (
                          <div style={{ marginTop: 6 }}>
                            {exp.proof_image.startsWith('data:application/pdf') ? (
                              <div style={{ padding: '10px 12px', background: '#fff7ed', border: '2px solid #fcd34d', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 20 }}>📄</span>
                                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600, wordBreak: 'break-all' }}>{exp.proof_name || 'document.pdf'}</span>
                              </div>
                            ) : (
                              <img src={exp.proof_image} alt="justificatif" style={{ maxWidth: '100%', maxHeight: 160, border: '2px solid #fcd34d', borderRadius: 6, display: 'block', marginBottom: 6 }} />
                            )}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, expenses: (prev.expenses || []).map((x, i) => i === idx ? { ...x, proof_image: null, proof_name: null } : x) }))}
                              style={{ padding: '5px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 5, border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                            >🗑️ Supprimer</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(formData.expenses || []).filter(e => !e.is_travel_zone && Number(e.amount || 0) > 0).length > 1 && (
                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#b45309', marginTop: 4 }}>
                      Total: {(formData.expenses || []).filter(e => !e.is_travel_zone).reduce((s, e) => s + Number(e.amount || 0), 0).toFixed(2)} €
                    </div>
                  )}
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
