import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import styles from './forgot-password.jsx'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Wait for router to be ready to access query parameters
    if (!router.isReady) return

    let { token: tokenParam } = router.query
    
    console.log('[reset-password] Raw token from router.query:', tokenParam)
    console.log('[reset-password] Raw token length:', tokenParam?.length)
    console.log('[reset-password] Raw token bytes:', tokenParam?.split('').map((c, i) => `${c}(${c.charCodeAt(0)})`).substring(0, 50))
    
    // Clean up token - remove URL encoding artifacts
    if (tokenParam) {
      // Decode any URL encoding issues
      try {
        const beforeDecode = tokenParam
        tokenParam = decodeURIComponent(tokenParam)
        console.log('[reset-password] After decodeURIComponent:', tokenParam)
        console.log('[reset-password] Changed?', beforeDecode !== tokenParam)
      } catch (e) {
        console.log('[reset-password] decodeURIComponent error:', e.message)
      }
      
      // Remove 3D= prefix if it exists (URL encoding artifact)
      if (tokenParam.startsWith('3D')) {
        console.log('[reset-password] Found 3D prefix, removing')
        tokenParam = tokenParam.substring(2)
      }
      
      // Remove = prefix if it exists
      if (tokenParam.startsWith('=')) {
        console.log('[reset-password] Found = prefix, removing')
        tokenParam = tokenParam.substring(1)
      }
      
      // Remove any trailing =
      const before = tokenParam
      tokenParam = tokenParam.replace(/=+$/, '')
      if (before !== tokenParam) {
        console.log('[reset-password] Removed trailing = signs')
      }
      console.log('[reset-password] Final token:', tokenParam)
      console.log('[reset-password] Final token length:', tokenParam?.length)
    }
    
    setToken(tokenParam || null)
    setIsReady(true)

    if (!tokenParam) {
      setError('Token de réinitialisation manquant')
    } else {
      console.log('[reset-password] Token set:', tokenParam.substring(0, 10) + '...')
    }
  }, [router.isReady, router.query])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    // Validation
    if (!password || !passwordConfirm) {
      setError('Veuillez remplir tous les champs')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setLoading(false)
      return
    }

    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    console.log('[reset-password] Submitting with token:', token)
    console.log('[reset-password] Token length:', token?.length)
    console.log('[reset-password] Token first 30:', token?.substring(0, 30))
    console.log('[reset-password] Token last 30:', token?.substring(token?.length - 30))

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          passwordConfirm
        })
      })

      const data = await res.json()
      console.log('[reset-password] Response:', data)

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la réinitialisation')
        return
      }

      setSuccess(true)
      setMessage('Mot de passe réinitialisé avec succès!')
      setPassword('')
      setPasswordConfirm('')

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#d32f2f', marginTop: 0 }}>Token invalide</h2>
          <p>Le lien de réinitialisation est invalid ou expiré.</p>
          <Link href="/forgot-password" style={{ color: '#0066cc', textDecoration: 'none' }}>
            Demander une nouvelle réinitialisation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ margin: '0 0 30px 0', color: '#333', fontSize: '24px', textAlign: 'center' }}>
          Réinitialiser le mot de passe
        </h2>

        {success ? (
          <div style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            color: '#155724',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            ✅ {message}
          </div>
        ) : null}

        {error && (
          <div style={{
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="password" style={{ fontWeight: '500', color: '#333' }}>
              Nouveau mot de passe:
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
              disabled={loading || success}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="passwordConfirm" style={{ fontWeight: '500', color: '#333' }}>
              Confirmer le mot de passe:
            </label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirmer le mot de passe"
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
              disabled={loading || success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            style={{
              padding: '12px',
              background: loading || success ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              marginTop: '10px'
            }}
          >
            {loading ? 'Traitement...' : success ? 'Mot de passe réinitialisé' : 'Réinitialiser'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          <Link href="/login" style={{ color: '#0066cc', textDecoration: 'none' }}>
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
