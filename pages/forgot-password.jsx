import { useState } from 'react'
import * as authService from '../services/authService'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!email) return setError('Adresse email requise')
    setLoading(true)
    try {
      const data = await authService.requestPasswordReset(email)
      setMessage(data?.message || 'Si ce compte existe, un email a été envoyé.')
      setEmail('')
    } catch (err) {
      setError(err.message || 'Erreur lors de la demande')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-root">
      <div className="card">
        <h1>Réinitialiser le mot de passe</h1>
        {message && <div className="form-success" role="status">{message}</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="label-text">Votre adresse email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@exemple.com"
              required
            />
          </label>

          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <Link href="/login">Retour à la connexion</Link>
        </div>
      </div>
    </div>
  )
}
