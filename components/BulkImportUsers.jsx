import React, { useState } from 'react'

export default function BulkImportUsers() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    if (lines.length === 0) return []

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = []

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim())
      if (cells.length < 2) continue

      const row = {}
      header.forEach((h, idx) => {
        row[h] = cells[idx] || ''
      })
      rows.push(row)
    }

    return rows
  }

  function handleCsvChange(e) {
    const text = e.target.value
    setCsvText(text)
    const rows = parseCSV(text)
    setPreview(rows)
  }

  async function handleImport() {
    if (preview.length === 0) {
      setError('Pas de données à importer')
      return
    }

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const r = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview })
      })

      if (!r.ok) throw new Error('Import failed')
      const d = await r.json()
      setResult(d)
      
      // If import successful, send invitations
      if (d.created && d.created.length > 0) {
        await sendInvitations(d.created)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function sendInvitations(users) {
    try {
      const r = await fetch('/api/admin/users/send-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users })
      })

      if (!r.ok) throw new Error('Failed to send invitations')
      alert(`Invitations envoyées à ${users.length} utilisateur(s)`)
    } catch (e) {
      console.error('send invitations failed', e)
      alert('Erreur lors de l\'envoi des emails')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          💡 Format CSV: email,first_name,last_name,role (optionnel, défaut: INFI)
        </div>
      </div>

      <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Coller le CSV</span>
          <textarea
            value={csvText}
            onChange={handleCsvChange}
            placeholder="email,first_name,last_name,role&#10;user1@example.com,Jean,Dupont,INFI&#10;user2@example.com,Marie,Martin,MED"
            style={{
              width: '100%',
              minHeight: 150,
              padding: '12px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
        </label>
      </div>

      {preview.length > 0 && (
        <div style={{ padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Aperçu ({preview.length} ligne(s))</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#e5e7eb', borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Email</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Prénom</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Nom</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Rôle</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: 8, color: '#1f2937' }}>{row.email}</td>
                    <td style={{ padding: 8, color: '#1f2937' }}>{row.first_name}</td>
                    <td style={{ padding: 8, color: '#1f2937' }}>{row.last_name}</td>
                    <td style={{ padding: 8, color: '#1f2937' }}>{row.role || 'INFI'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && (
              <div style={{ padding: 8, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>
                … et {preview.length - 5} ligne(s) supplémentaire(s)
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 12 }}>✅ Import terminé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{result.summary.total}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Créés</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{result.summary.created}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Erreurs</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{result.summary.failed}</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Erreurs:</div>
              {result.errors.slice(0, 5).map((err, i) => (
                <div key={i} style={{ fontSize: 11, color: '#991b1b' }}>
                  Ligne {err.line}: {err.reason}
                </div>
              ))}
              {result.errors.length > 5 && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  … et {result.errors.length - 5} erreur(s) supplémentaire(s)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={importing || preview.length === 0}
        style={{
          padding: '12px 24px',
          background: preview.length > 0 ? '#0366d6' : '#d1d5db',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: importing || preview.length === 0 ? 'not-allowed' : 'pointer',
          opacity: importing ? 0.7 : 1,
          fontSize: 14
        }}
      >
        {importing ? 'Import en cours…' : `Importer ${preview.length} utilisateur(s)`}
      </button>
    </div>
  )
}
