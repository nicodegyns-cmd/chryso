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
      console.log('Authentifié', data)
      // store token if provided
      if (data.token) localStorage.setItem('token', data.token)
      // store email for profile lookup
      localStorage.setItem('email', email)
      // store role for client-side guard
      // Normalize role values to canonical tokens used by the client ('INFI','MED','admin','user')
      let role = (data.role || 'user').toString()
      const low = role.toLowerCase()
      if (low.includes('infi') || low.includes('infirm')) role = 'INFI'
      else if (low.includes('med') || low.includes('médec')) role = 'MED'
      else if (low === 'admin') role = 'admin'
      else role = 'user'
      localStorage.setItem('role', role)
      // redirect based on role
      if (role === 'admin') {
        window.location.href = '/admin'
      } else {
        window.location.href = '/'
      }
    } catch (err) {
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
