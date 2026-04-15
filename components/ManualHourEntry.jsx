import React, { useState, useEffect, useRef, useMemo } from 'react'
import styles from './ManualHourEntry.module.css'

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  hours_actual: '',
  garde_hours: '',
  sortie_hours: '',
  overtime_hours: '',
  activity_id: '',
  comments: '',
  pay_type: 'Normal'
})

const STATUS_STYLES = {
  "En attente d'approbation": { bg: '#e0e7ff', color: '#3730a3' },
  "En attente d'envoie":      { bg: '#fef3c7', color: '#92400e' },
  "Envoyé à la facturation":  { bg: '#dcfce7', color: '#166534' },
  "Annulé":                   { bg: '#fee2e2', color: '#991b1b' },
  "A saisir":                 { bg: '#fecaca', color: '#b91c1c' },
}

function formatDate(d) {
  if (!d) return '-'
  const s = String(d).slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

export default function ManualHourEntry() {
  const [allUsers, setAllUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPrestations, setUserPrestations] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingPrests, setLoadingPrests] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingPrestation, setEditingPrestation] = useState(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  // Form state
  const [formData, setFormData] = useState(emptyForm())

  // Load users and activities
  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, activitiesRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/analytics')
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setAllUsers(data.users || [])
        }
        if (activitiesRes.ok) {
          const data = await activitiesRes.json()
          setActivities(data.analytics || [])
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Erreur lors du chargement des données')
      }
    }
    loadData()
  }, [])

  // Click outside to close suggestions
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filtered suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase()
    return allUsers.filter(u => {
      const name = `${u.firstname || ''} ${u.lastname || ''} ${u.email || ''}`.toLowerCase()
      return name.includes(q)
    }).slice(0, 8)
  }, [allUsers, searchQuery])

  // Load user prestations when user is selected
  useEffect(() => {
    if (!selectedUser) {
      setUserPrestations([])
      return
    }
    const loadUserPrestations = async () => {
      setLoadingPrests(true)
      try {
        const res = await fetch(`/api/admin/user-prestations?user_id=${selectedUser.id}`)
        const data = await res.json()
        if (res.ok) {
          setUserPrestations(data.prestations || [])
        } else {
          setError(data.message || 'Erreur lors du chargement des prestations')
        }
      } catch (err) {
        console.error('Error loading prestations:', err)
        setError('Erreur lors du chargement des prestations')
      } finally {
        setLoadingPrests(false)
      }
    }
    loadUserPrestations()
  }, [selectedUser])

  const handleUserSelect = (user) => {
    setSelectedUser(user)
    setSearchQuery(`${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email)
    setShowSuggestions(false)
    setEditingPrestation(null)
    setError('')
    setSuccess('')
    setFormData(emptyForm())
  }

  const handleClearUser = () => {
    setSelectedUser(null)
    setSearchQuery('')
    setUserPrestations([])
    setEditingPrestation(null)
    setError('')
    setSuccess('')
    setFormData(emptyForm())
  }

  const handleEditPrestation = (prestation) => {
    setEditingPrestation(prestation)
    setFormData({
      date: prestation.date ? String(prestation.date).slice(0, 10) : new Date().toISOString().split('T')[0],
      hours_actual: prestation.hours_actual ? String(prestation.hours_actual) : '',
      garde_hours: prestation.garde_hours ? String(prestation.garde_hours) : '',
      sortie_hours: prestation.sortie_hours ? String(prestation.sortie_hours) : '',
      overtime_hours: prestation.overtime_hours ? String(prestation.overtime_hours) : '',
      activity_id: prestation.activity_id ? String(prestation.activity_id) : '',
      comments: prestation.comments || '',
      pay_type: prestation.pay_type || 'Normal'
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingPrestation(null)
    setFormData(emptyForm())
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) {
      setError('Veuillez sélectionner un utilisateur')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        user_id: selectedUser.id,
        ...formData,
        hours_actual: formData.hours_actual ? parseFloat(formData.hours_actual) : null,
        garde_hours: formData.garde_hours ? parseFloat(formData.garde_hours) : null,
        sortie_hours: formData.sortie_hours ? parseFloat(formData.sortie_hours) : null,
        overtime_hours: formData.overtime_hours ? parseFloat(formData.overtime_hours) : null,
        activity_id: formData.activity_id ? parseInt(formData.activity_id) : null
      }

      const method = editingPrestation ? 'PUT' : 'POST'
      const url = editingPrestation 
        ? `/api/admin/manual-hours?id=${editingPrestation.id}` 
        : '/api/admin/manual-hours'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Erreur lors de la création')
      }

      const result = await res.json()
      setSuccess(editingPrestation ? '✅ Heures modifiées avec succès!' : '✅ Heures enregistrées avec succès!')

      // Reset form
      cancelEdit()

      // Reload prestations
      const prestRes = await fetch(`/api/admin/user-prestations?user_id=${selectedUser.id}`)
      if (prestRes.ok) {
        const data = await prestRes.json()
        setUserPrestations(data.prestations || [])
      }

      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error submitting form:', err)
      setError(err.message || "Erreur lors de l'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  const statusStyle = (status) => STATUS_STYLES[status] || { bg: '#f3f4f6', color: '#374151' }

  return (
    <div className={styles.container}>
      {/* ── User search ── */}
      <div className={styles.section}>
        <h3 style={{ marginTop: 0 }}>1. Rechercher un utilisateur</h3>
        <div ref={searchRef} style={{ position: 'relative', maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); if (!e.target.value) handleClearUser() }}
              onFocus={() => { if (searchQuery.length >= 2) setShowSuggestions(true) }}
              placeholder="Nom, prénom ou email…"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }}
              disabled={!!selectedUser}
            />
            {selectedUser && (
              <button
                onClick={handleClearUser}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ✕ Changer
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && !selectedUser && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
              {suggestions.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleUserSelect(u)}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                    {u.firstname || u.lastname ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : u.email}
                  </span>
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
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
                {selectedUser.firstname || selectedUser.lastname
                  ? `${selectedUser.firstname || ''} ${selectedUser.lastname || ''}`.trim()
                  : selectedUser.email}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedUser.email}</div>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          {/* ── Prestations cards ── */}
          <div className={styles.section}>
            <h3>2. Prestations de l'utilisateur</h3>
            {loadingPrests ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Chargement des prestations…</p>
            ) : userPrestations.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Aucune prestation pour cet utilisateur.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
                {userPrestations.map(p => {
                  const st = statusStyle(p.status)
                  const isEdit = editingPrestation?.id === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleEditPrestation(p)}
                      style={{
                        background: isEdit ? '#f5f3ff' : '#fff',
                        border: `2px solid ${isEdit ? '#7c3aed' : '#e5e7eb'}`,
                        borderRadius: 10,
                        padding: 16,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isEdit ? '0 0 0 3px #c4b5fd' : '0 1px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                          {p.status || 'En attente'}
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{formatDate(p.date)}</span>
                      </div>
                      {p.analytic_name && <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 8 }}>{p.analytic_name}</div>}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {p.hours_actual > 0 && <div style={{ fontSize: 13 }}><span style={{ color: '#6b7280' }}>Réelles </span><strong>{p.hours_actual}h</strong></div>}
                        {p.garde_hours > 0 && <div style={{ fontSize: 13 }}><span style={{ color: '#6b7280' }}>Garde </span><strong>{p.garde_hours}h</strong></div>}
                        {p.sortie_hours > 0 && <div style={{ fontSize: 13 }}><span style={{ color: '#6b7280' }}>Sortie </span><strong>{p.sortie_hours}h</strong></div>}
                      </div>
                      {p.pay_type && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{p.pay_type}</div>}
                      {p.comments && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 6, fontStyle: 'italic' }}>{p.comments}</div>}
                      {isEdit && (
                        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>✏️ En cours d'édition</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Form ── */}
          <div className={styles.section}>
            <h3>{editingPrestation ? `3. Modifier la prestation du ${formatDate(editingPrestation.date)}` : '3. Déclarer de nouvelles heures'}</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="date">Date :</label>
                  <input id="date" type="date" name="date" value={formData.date} onChange={handleFormChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="pay_type">Type de rémunération :</label>
                  <select id="pay_type" name="pay_type" value={formData.pay_type} onChange={handleFormChange}>
                    <option value="Normal">Normal</option>
                    <option value="Garde">Garde</option>
                    <option value="Sortie">Sortie</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="hours_actual">Heures réelles :</label>
                  <input id="hours_actual" type="number" step="0.25" name="hours_actual" value={formData.hours_actual} onChange={handleFormChange} placeholder="0" min="0" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="garde_hours">Heures de garde :</label>
                  <input id="garde_hours" type="number" step="0.25" name="garde_hours" value={formData.garde_hours} onChange={handleFormChange} placeholder="0" min="0" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="sortie_hours">Heures de sortie :</label>
                  <input id="sortie_hours" type="number" step="0.25" name="sortie_hours" value={formData.sortie_hours} onChange={handleFormChange} placeholder="0" min="0" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="activity_id">Activité (optionnel) :</label>
                  <select id="activity_id" name="activity_id" value={formData.activity_id} onChange={handleFormChange}>
                    <option value="">-- Sélectionner une activité --</option>
                    {activities.map(activity => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name || `Activité ${activity.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label htmlFor="comments">Commentaires :</label>
                  <textarea id="comments" name="comments" value={formData.comments} onChange={handleFormChange} placeholder="Ajouter des notes…" rows="3" />
                </div>
              </div>

              {error && <div className={styles.error}>{error}</div>}
              {success && <div className={styles.success}>{success}</div>}

              <div className={styles.buttonGroup}>
                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Enregistrement…' : editingPrestation ? '✏️ Modifier les heures' : '✓ Enregistrer les heures'}
                </button>
                {editingPrestation && (
                  <button type="button" onClick={cancelEdit} disabled={loading} className={styles.cancelBtn}>
                    ✕ Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
