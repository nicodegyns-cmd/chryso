import { useState } from 'react'
import Link from 'next/link'
import * as authService from '../services/authService'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email) return setError('Email requis')
    if (!password) return setError('Mot de passe requis')
    setLoading(true)
    try {
      const data = await authService.login(email, password)
      console.log('[LoginForm] Authentifié', data)
      // store token if provided
      if (data.token) localStorage.setItem('token', data.token)
      // store email for profile lookup
      localStorage.setItem('email', email)
      // store role(s) for client-side guard
      // support `data.roles` (array) or `data.role` (single)
      const rawRoles = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : (data.role ? [data.role] : ['user'])
      console.log('[LoginForm] rawRoles from API:', rawRoles)
      // normalize roles to canonical tokens used by the client
      function norm(r) {
        if (!r) return 'user'
        const low = r.toString().toLowerCase().trim()
        if (low.includes('infi') || low.includes('infirm')) return 'INFI'
        if (low.includes('med') || low.includes('médec')) return 'MED'
        if (low === 'admin') return 'admin'
        if (low.includes('moder') || low.includes('modér')) return 'moderator'
        if (low === 'comptabilite' || low.includes('comptab')) return 'comptabilite'
        return 'user'
      }
      const normalized = Array.from(new Set(rawRoles.map(norm)))
      console.log('[LoginForm] normalized roles:', normalized)
      localStorage.setItem('roles', JSON.stringify(normalized))
      // set the active role (keep previous if still valid)
      const prev = localStorage.getItem('role') || normalized[0]
      const active = normalized.includes(prev) ? prev : normalized[0]
      console.log('[LoginForm] setting active role to:', active)
      localStorage.setItem('role', active)
      // redirect based on active role
      const r = localStorage.getItem('role')
      console.log('[LoginForm] redirecting to role page:', r)
      if (r === 'admin') window.location.href = '/admin'
      else if (r === 'comptabilite') window.location.href = '/comptabilite'
      else window.location.href = '/'
    } catch (err) {
      console.error('[LoginForm] error:', err)
      setError(err.message || 'Erreur lors de la connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label className="field">
        <span className="label-text">Adresse email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@exemple.com"
          required
          />
      </label>

      <label className="field">
        <span className="label-text">Mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </label>

      <button className="primary" type="submit" disabled={loading}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </button>
      <div className="forgot-link" style={{ marginTop: 10, textAlign: 'right' }}>
        <Link href="/forgot-password">Mot de passe oublié ?</Link>
      </div>
      
    </form>
  )
}
