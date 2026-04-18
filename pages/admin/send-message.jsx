import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import { useLocalStorage } from '../../hooks/useLocalStorage'

export default function SendMessagePage() {
  const router = useRouter()
  const userRole = useLocalStorage('role', null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  
  const [form, setForm] = useState({
    recipientType: 'individual', // 'individual' ou 'role'
    selectedUser: '',
    selectedRole: '',
    subject: '',
    message: '',
  })

  // Check role access
  useEffect(() => {
    if (userRole === null) return
    if (!['admin', 'moderator', 'comptabilite'].includes(userRole)) {
      router.push('/dashboard')
    }
  }, [userRole, router])

  // Load users
  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        setUsers(data.users || [])
      } catch (err) {
        console.error('Failed to load users:', err)
        setError('Erreur lors du chargement des utilisateurs')
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    setSuccess(false)

    try {
      if (!form.subject?.trim()) {
        setError('Le sujet est requis')
        return
      }
      if (!form.message?.trim()) {
        setError('Le message est requis')
        return
      }
      if (form.recipientType === 'individual' && !form.selectedUser) {
        setError('Veuillez sélectionner un utilisateur')
        return
      }
      if (form.recipientType === 'role' && !form.selectedRole) {
        setError('Veuillez sélectionner un rôle')
        return
      }

      const res = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientType: form.recipientType,
          recipientId: form.recipientType === 'individual' ? form.selectedUser : undefined,
          recipientRole: form.recipientType === 'role' ? form.selectedRole : undefined,
          subject: form.subject,
          message: form.message,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }

      const data = await res.json()
      setSuccess(true)
      setForm({ recipientType: 'individual', selectedUser: '', selectedRole: '', subject: '', message: '' })
      
      setTimeout(() => {
        setSuccess(false)
      }, 5000)
    } catch (err) {
      console.error('Send message failed:', err)
      setError(err.message || 'Erreur lors de l\'envoi du message')
    } finally {
      setSending(false)
    }
  }

  // Get unique roles from users
  const roles = [...new Set(users.flatMap(u => Array.isArray(u.role) ? u.role : [u.role]).filter(Boolean))]

  if (loading) {
    return (
      <div className="admin-page-root">
        <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="admin-content">
          <div className="admin-header">
            <h1>Envoyer un message</h1>
          </div>
          <div style={{ padding: 20, textAlign: 'center' }}>Chargement...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Envoyer un message</h1>
          <div className="small-muted">Envoyez un email à un utilisateur ou à tous les utilisateurs d'un rôle</div>
        </div>

        <div className="admin-card card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
            {/* Success Message */}
            {success && (
              <div style={{
                padding: 12,
                background: '#d1fae5',
                color: '#065f46',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
              }}>
                ✅ Message(s) envoyé(s) avec succès!
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{
                padding: 12,
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
              }}>
                ❌ {error}
              </div>
            )}

            {/* Recipient Type Selection */}
            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Type de destinataire</span>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="recipientType"
                    value="individual"
                    checked={form.recipientType === 'individual'}
                    onChange={(e) => setForm({ ...form, recipientType: e.target.value, selectedUser: '', selectedRole: '' })}
                  />
                  <span style={{ fontSize: 14 }}>Utilisateur</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="recipientType"
                    value="role"
                    checked={form.recipientType === 'role'}
                    onChange={(e) => setForm({ ...form, recipientType: e.target.value, selectedUser: '', selectedRole: '' })}
                  />
                  <span style={{ fontSize: 14 }}>Par rôle</span>
                </label>
              </div>
            </label>

            {/* Individual User Selection */}
            {form.recipientType === 'individual' && (
              <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sélectionner un utilisateur</span>
                <select
                  value={form.selectedUser}
                  onChange={(e) => setForm({ ...form, selectedUser: e.target.value })}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">-- Choisir un utilisateur --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name || user.firstName} {user.last_name || user.lastName} ({user.email})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Role Selection */}
            {form.recipientType === 'role' && (
              <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sélectionner un rôle</span>
                <select
                  value={form.selectedRole}
                  onChange={(e) => setForm({ ...form, selectedRole: e.target.value })}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">-- Choisir un rôle --</option>
                  {roles.map(role => {
                    const count = users.filter(u => {
                      const userRoles = Array.isArray(u.role) ? u.role : [u.role]
                      return userRoles.includes(role)
                    }).length
                    return (
                      <option key={role} value={role}>
                        {role} ({count} utilisateur{count !== 1 ? 's' : ''})
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {/* Subject */}
            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sujet *</span>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex: Mise à jour importante"
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                }}
                required
              />
            </label>

            {/* Message */}
            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Message *</span>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Écrivez votre message ici..."
                rows={8}
                style={{
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                required
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {form.message.length} caractères
              </div>
            </label>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setForm({ recipientType: 'individual', selectedUser: '', selectedRole: '', subject: '', message: '' })}
                disabled={sending}
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                className="primary"
                disabled={sending || !form.subject?.trim() || !form.message?.trim()}
                style={{
                  opacity: (sending || !form.subject?.trim() || !form.message?.trim()) ? 0.6 : 1,
                }}
              >
                {sending ? 'Envoi en cours...' : '📧 Envoyer le message'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
