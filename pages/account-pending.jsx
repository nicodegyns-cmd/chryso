import React, { useEffect, useState } from 'react'
import AdminHeader from '../components/AdminHeader'

export default function AccountPendingPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
      if (!email) {
        if (typeof window !== 'undefined') window.location.href = '/login'
        return
      }

      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
        if (me) {
          // If user is already validated and active, redirect to dashboard
          if (me.is_active === 1) {
            if (typeof window !== 'undefined') window.location.href = '/dashboard'
            return
          }
          setUser(me)
        }
      } catch (err) {
        console.error('Failed to load profile', err)
      } finally {
        setLoading(false)
      }
    }

    load()

    // Auto-refresh every 5 seconds to check if account is validated
    const interval = setInterval(load, 5000)
    
    return () => clearInterval(interval)
  }, [])

  function handleLogout() {
    localStorage.removeItem('email')
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <div className="admin-page-root">
      <AdminHeader />

      <main style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)',
        padding: 20,
        background: '#f9fafb'
      }}>
        {loading ? (
          <div style={{
            background: '#fff',
            padding: 40,
            borderRadius: 12,
            textAlign: 'center',
            color: '#6b7280'
          }}>
            Chargement…
          </div>
        ) : (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            maxWidth: 500,
            width: '100%',
            padding: 40,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: 48,
              marginBottom: 20
            }}>
              ⏳
            </div>

            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: 12,
              margin: '0 0 12px 0'
            }}>
              Compte en attente de validation
            </h1>

            <p style={{
              fontSize: 16,
              color: '#6b7280',
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              Merci de vous être inscrit ! Votre compte a été créé avec succès.
            </p>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24
            }}>
              <p style={{
                fontSize: 14,
                color: '#166534',
                margin: 0,
                lineHeight: 1.6
              }}>
                ✓ Votre profil a été complété<br/>
                ✓ Vous avez accepté les conditions<br/>
                ✓ Votre mot de passe a été changé
              </p>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 8,
              padding: 16,
              marginBottom: 28
            }}>
              <p style={{
                fontSize: 13,
                color: '#92400e',
                margin: 0,
                lineHeight: 1.5,
                fontWeight: 500
              }}>
                Votre compte est maintenant <strong>en cours de validation</strong> par l'administration. Cette étape peut prendre quelques heures. Nous vous enverrons un email dès que votre compte sera activé.
              </p>
            </div>

            <div style={{
              background: '#f3f4f6',
              borderRadius: 8,
              padding: 16,
              marginBottom: 28
            }}>
              <p style={{
                fontSize: 13,
                color: '#6b7280',
                margin: 0,
                lineHeight: 1.5
              }}>
                {user ? (
                  <>
                    <strong>Email : </strong>{user.email}<br/>
                    <strong>Nom : </strong>{user.first_name} {user.last_name}<br/>
                    <strong>Statut : </strong>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>En attente de validation</span>
                  </>
                ) : (
                  <>Chargement des informations…</>
                )}
              </p>
            </div>

            <button
              onClick={handleLogout}
              style={{
                padding: '12px 24px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = '#1d4ed8'}
              onMouseLeave={e => e.target.style.background = '#2563eb'}
            >
              Se déconnecter
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
