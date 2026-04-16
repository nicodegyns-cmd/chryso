import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LogoHeader from '../components/LogoHeader'

export default function SignupPage() {
  const router = useRouter()
  const { token } = router.query
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    passwordConfirm: '',
    telephone: '',
    address: '',
    fonction: '',
    company: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Fetch user details by token
  useEffect(() => {
    if (!token) return
    
    async function loadUser() {
      setLoading(true)
      try {
        const r = await fetch(`/api/users/by-token?token=${encodeURIComponent(token)}`)
        if (!r.ok) throw new Error('Invalid or expired token')
        
        const d = await r.json()
        setUser(d.user)
        setForm(prev => ({
          ...prev,
          email: d.user.email,
          first_name: d.user.first_name || '',
          last_name: d.user.last_name || ''
        }))
      } catch (e) {
        setError(e.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }
    
    loadUser()
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validate
    if (!form.email || !form.first_name || !form.last_name) {
      setError('Email, prénom et nom sont requis')
      return
    }

    if (!form.password || form.password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères')
      return
    }

    if (form.password !== form.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (!form.telephone?.trim()) {
      setError('Le numéro de téléphone est requis')
      return
    }
    if (!form.address?.trim()) {
      setError("L'adresse est requise")
      return
    }
    if (!form.fonction?.trim()) {
      setError('La fonction est requise')
      return
    }

    setSubmitting(true)
    try {
      const r = await fetch('/api/users/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          password: form.password,
          telephone: form.telephone || null,
          address: form.address || null,
          fonction: form.fonction || null,
          company: form.company || null
        })
      })

      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || 'Signup failed')
      }

      setSuccess(true)
      localStorage.setItem('email', form.email)
      setTimeout(() => router.push('/account-pending'), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Chargement…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 12, maxWidth: 400, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: 0, color: '#991b1b' }}>❌ Lien invalide ou expiré</h2>
          <p style={{ color: '#6b7280', marginTop: 12 }}>Ce lien d'invitation a expiré ou n'existe pas. Contactez votre administrateur.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 12, maxWidth: 400, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#15803d' }}>✅ Inscription réussie!</h2>
          <p style={{ color: '#6b7280', marginTop: 12 }}>Redirection vers la connexion…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <LogoHeader />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: 24, fontWeight: 700, color: '#1f2937' }}>Compléter votre profil</h2>

          {error && (
            <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: 16 }}>
            {/* Identifiant */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>📧 Identifiant</h3>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  disabled
                />
              </label>
            </div>

            {/* Infos Personnelles */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>👤 Informations personnelles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Prénom *</span>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                    required
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Nom *</span>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                    required
                  />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Téléphone *</span>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={e => setForm({ ...form, telephone: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  required
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Adresse *</span>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  required
                />
              </label>
            </div>

            {/* Infos Professionnelles */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>💼 Informations professionnelles</h3>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Fonction *</span>
                <input
                  type="text"
                  value={form.fonction}
                  onChange={e => setForm({ ...form, fonction: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  placeholder="Ex: Infirmier, Médecin…"
                  required
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Entreprise <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel)</span></span>
                <input
                  type="text"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
              </label>
            </div>

            {/* Password */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>🔐 Sécurité</h3>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Mot de passe *</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  required
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Confirmer mot de passe *</span>
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={e => setForm({ ...form, passwordConfirm: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
                padding: '12px 24px',
                background: '#0366d6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontSize: 14
              }}
            >
              {submitting ? 'Traitement…' : 'Compléter inscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
