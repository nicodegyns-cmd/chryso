import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function EmailDiagnosticPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [smtpStatus, setSmtpStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSmtpStatus()
  }, [])

  async function checkSmtpStatus() {
    try {
      const res = await fetch('/api/admin/email-status')
      const data = await res.json()
      setSmtpStatus(data)
    } catch (err) {
      setSmtpStatus({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function sendTest() {
    if (!testEmail?.trim()) {
      setResult({ error: 'Veuillez entrer une adresse email' })
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/admin/test-email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Diagnostic Email</h1>
          <div className="small-muted">Vérifier la configuration SMTP et tester l'envoi d'emails</div>
        </div>

        <div className="card" style={{padding: 24, marginBottom: 24}}>
          <h2 style={{marginTop: 0, marginBottom: 16}}>Status SMTP</h2>
          {loading ? (
            <div>Chargement...</div>
          ) : smtpStatus?.configured ? (
            <div style={{background: '#ecfdf5', padding: 16, borderRadius: 8, borderLeft: '4px solid #10b981'}}>
              <p style={{margin: 0, color: '#065f46', fontWeight: 600}}>✓ SMTP est configuré</p>
              <p style={{margin: '8px 0 0 0', color: '#047857', fontSize: 14}}>
                Fournisseur: <strong>{smtpStatus.provider}</strong>
              </p>
              <p style={{margin: '4px 0 0 0', color: '#047857', fontSize: 14}}>
                From Email: <strong>{smtpStatus.fromEmail}</strong>
              </p>
            </div>
          ) : (
            <div style={{background: '#fef3c7', padding: 16, borderRadius: 8, borderLeft: '4px solid #f59e0b'}}>
              <p style={{margin: 0, color: '#92400e', fontWeight: 600}}>⚠️ SMTP n'est PAS configuré</p>
              <p style={{margin: '8px 0 0 0', color: '#b45309', fontSize: 14}}>
                Les emails seront loggés dans la console seulement.
              </p>
              <p style={{margin: '4px 0 0 0', color: '#b45309', fontSize: 14}}>
                Erreur: {smtpStatus?.error || smtpStatus?.message}
              </p>
            </div>
          )}
        </div>

        <div className="card" style={{padding: 24}}>
          <h2 style={{marginTop: 0, marginBottom: 16}}>Test d'envoi</h2>
          <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="adresse@email.com"
              style={{flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14}}
            />
            <button
              onClick={sendTest}
              disabled={sending}
              style={{
                padding: '10px 24px',
                background: sending ? '#ccc' : '#0366d6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer'
              }}
            >
              {sending ? 'Envoi...' : 'Envoyer test'}
            </button>
          </div>

          {result && (
            <div style={{
              padding: 16,
              borderRadius: 8,
              borderLeft: '4px solid ' + (result.sent ? '#10b981' : '#ef4444'),
              background: result.sent ? '#ecfdf5' : '#fef2f2'
            }}>
              <p style={{margin: 0, color: result.sent ? '#065f46' : '#7f1d1d', fontWeight: 600}}>
                {result.sent ? '✓ Email envoyé' : '✗ Erreur d\'envoi'}
              </p>
              <p style={{margin: '8px 0 0 0', fontSize: 14, color: result.sent ? '#047857' : '#991b1b'}}>
                {result.message || result.error || (result.sent ? 'Message ID: ' + result.messageId : 'Une erreur est survenue')}
              </p>
            </div>
          )}
        </div>

        <div className="card" style={{padding: 24, marginTop: 24}}>
          <h2 style={{marginTop: 0}}>Variables d'environnement</h2>
          <pre style={{
            background: '#f3f4f6',
            padding: 16,
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.6,
            margin: 0
          }}>
{`EMAIL_PROVIDER: ${smtpStatus?.env?.EMAIL_PROVIDER || 'non défini'}
SMTP_HOST: ${smtpStatus?.env?.SMTP_HOST || 'non défini'}
SMTP_PORT: ${smtpStatus?.env?.SMTP_PORT || 'non défini'}
SMTP_FROM: ${smtpStatus?.env?.SMTP_FROM || 'non défini'}
SMTP_SECURE: ${smtpStatus?.env?.SMTP_SECURE || 'non défini'}
SMTP_USER: ${smtpStatus?.env?.SMTP_USER ? '***configuré***' : 'non défini'}
SMTP_PASSWORD: ${smtpStatus?.env?.SMTP_PASSWORD ? '***configuré***' : 'non défini'}`}
          </pre>
        </div>
      </main>
    </div>
  )
}
