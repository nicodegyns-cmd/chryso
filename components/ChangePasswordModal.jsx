import { useState } from 'react'
import styles from '../styles/globals.css'

export default function ChangePasswordModal({ isOpen, onClose, token }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tous les champs sont requis')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas')
      return
    }

    if (newPassword.length < 4) {
      setError('Le nouveau mot de passe doit contenir au moins 4 caractères')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors du changement de mot de passe')
        return
      }

      setSuccess('Mot de passe changé avec succès!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setError('Erreur serveur: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2>Changer le mot de passe</h2>

        <form onSubmit={handleChangePassword}>
          <div style={styles.formGroup}>
            <label>Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Entrez votre mot de passe actuel"
              disabled={loading}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Entrez votre nouveau mot de passe"
              disabled={loading}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmez votre nouveau mot de passe"
              disabled={loading}
            />
          </div>

          {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: '10px' }}>{success}</div>}

          <div style={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={styles.btnSecondary}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              style={styles.btnPrimary}
            >
              {loading ? 'Changement en cours...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
