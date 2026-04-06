import React, { useState, useEffect } from 'react'
import styles from './ManualHourEntry.module.css'

export default function ManualHourEntry() {
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPrestations, setUserPrestations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    hours_actual: '',
    garde_hours: '',
    sortie_hours: '',
    overtime_hours: '',
    activity_id: '',
    comments: '',
    pay_type: 'Normal'
  })

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
          setUsers(data.users || [])
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

  // Load user prestations when user is selected
  useEffect(() => {
    if (!selectedUser) {
      setUserPrestations([])
      return
    }

    const loadUserPrestations = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/user-prestations?user_id=${selectedUser.id}`)
        if (res.ok) {
          const data = await res.json()
          setUserPrestations(data.prestations || [])
        }
      } catch (err) {
        console.error('Error loading prestations:', err)
      } finally {
        setLoading(false)
      }
    }

    loadUserPrestations()
  }, [selectedUser])

  const handleUserSelect = (user) => {
    setSelectedUser(user)
    setError('')
    setSuccess('')
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

      const res = await fetch('/api/admin/manual-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Erreur lors de la création')
      }

      const result = await res.json()
      setSuccess('✅ Heures enregistrées avec succès!')

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        hours_actual: '',
        garde_hours: '',
        sortie_hours: '',
        overtime_hours: '',
        activity_id: '',
        comments: '',
        pay_type: 'Normal'
      })

      // Reload prestations
      const prestRes = await fetch(`/api/admin/user-prestations?user_id=${selectedUser.id}`)
      if (prestRes.ok) {
        const data = await prestRes.json()
        setUserPrestations(data.prestations || [])
      }

      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error submitting form:', err)
      setError(err.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📝 Encodage Manuel des Heures</h2>
        <p>Déclarer manuellement les heures de travail d'un utilisateur</p>
      </div>

      <div className={styles.content}>
        {/* Users Selection */}
        <div className={styles.section}>
          <h3>1. Sélectionner un utilisateur</h3>
          <div className={styles.usersList}>
            {users.map(user => (
              <button
                key={user.id}
                className={`${styles.userButton} ${selectedUser?.id === user.id ? styles.active : ''}`}
                onClick={() => handleUserSelect(user)}
              >
                <div className={styles.userName}>{user.name || user.email}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedUser && (
          <>
            {/* User Prestations Cards */}
            <div className={styles.section}>
              <h3>📋 Cartes de l'utilisateur (Demandes en cours)</h3>
              {loading ? (
                <p className={styles.loading}>Chargement des cartes...</p>
              ) : userPrestations.length > 0 ? (
                <div className={styles.cardsList}>
                  {userPrestations.map(prestation => (
                    <div key={prestation.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <span className={`${styles.status} ${styles[`status-${prestation.status?.toLowerCase().replace(' ', '-')}`]}`}>
                          {prestation.status || 'En attente'}
                        </span>
                        <span className={styles.date}>{prestation.date || 'N/A'}</span>
                      </div>
                      <div className={styles.cardBody}>
                        {prestation.hours_actual && (
                          <div className={styles.cardRow}>
                            <span>Heures réelles:</span>
                            <strong>{prestation.hours_actual}h</strong>
                          </div>
                        )}
                        {prestation.garde_hours && (
                          <div className={styles.cardRow}>
                            <span>Garde:</span>
                            <strong>{prestation.garde_hours}h</strong>
                          </div>
                        )}
                        {prestation.sortie_hours && (
                          <div className={styles.cardRow}>
                            <span>Sortie:</span>
                            <strong>{prestation.sortie_hours}h</strong>
                          </div>
                        )}
                        {prestation.overtime_hours && (
                          <div className={styles.cardRow}>
                            <span>Heures sup:</span>
                            <strong>{prestation.overtime_hours}h</strong>
                          </div>
                        )}
                        {prestation.comments && (
                          <div className={styles.cardRow}>
                            <span>Commentaires:</span>
                            <p className={styles.comments}>{prestation.comments}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noData}>Aucune carte pour cet utilisateur</p>
              )}
            </div>

            {/* Form */}
            <div className={styles.section}>
              <h3>2. Déclarer les heures</h3>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="date">Date:</label>
                    <input
                      id="date"
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="pay_type">Type de rémunération:</label>
                    <select
                      id="pay_type"
                      name="pay_type"
                      value={formData.pay_type}
                      onChange={handleFormChange}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Garde">Garde</option>
                      <option value="Sortie">Sortie</option>
                      <option value="Overtime">Heures sup</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="hours_actual">Heures réelles:</label>
                    <input
                      id="hours_actual"
                      type="number"
                      step="0.25"
                      name="hours_actual"
                      value={formData.hours_actual}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="garde_hours">Heures de garde:</label>
                    <input
                      id="garde_hours"
                      type="number"
                      step="0.25"
                      name="garde_hours"
                      value={formData.garde_hours}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="sortie_hours">Heures de sortie:</label>
                    <input
                      id="sortie_hours"
                      type="number"
                      step="0.25"
                      name="sortie_hours"
                      value={formData.sortie_hours}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="overtime_hours">Heures supplémentaires:</label>
                    <input
                      id="overtime_hours"
                      type="number"
                      step="0.25"
                      name="overtime_hours"
                      value={formData.overtime_hours}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="activity_id">Activité (optionnel):</label>
                    <select
                      id="activity_id"
                      name="activity_id"
                      value={formData.activity_id}
                      onChange={handleFormChange}
                    >
                      <option value="">-- Sélectionner une activité --</option>
                      {activities.map(activity => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name || `Activité ${activity.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label htmlFor="comments">Commentaires:</label>
                    <textarea
                      id="comments"
                      name="comments"
                      value={formData.comments}
                      onChange={handleFormChange}
                      placeholder="Ajouter des notes..."
                      rows="3"
                    />
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}

                <button
                  type="submit"
                  disabled={loading || !selectedUser}
                  className={styles.submitBtn}
                >
                  {loading ? 'Enregistrement...' : '✓ Enregistrer les heures'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
