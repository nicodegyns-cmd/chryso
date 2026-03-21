import React, { useEffect, useState } from 'react'

export default function eBrigadePrestationsDisplay({ email }) {
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState('2026-03-21')
  const [dateTo, setDateTo] = useState('2026-03-28')

  // Initialize on mount
  useEffect(() => {
    const today = new Date()
    const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().split('T')[0]
    setDateFrom(fmt(today))
    setDateTo(fmt(inSevenDays))
    console.log('[eBrigade] Component mounted, dates initialized')
  }, [])

  // Auto-load when dates are set (only once after init)
  useEffect(() => {
    if (dateFrom && dateTo) {
      console.log('[eBrigade] Loading with dates:', dateFrom, dateTo)
      loadPrestations()
    }
  }, [])

  async function loadPrestations() {
    setLoading(true)
    setError(null)
    
    try {
      const userEmail = typeof window !== 'undefined' ? localStorage.getItem('email') : null
      if (!userEmail) {
        setError('Email not found in localStorage')
        setLoading(false)
        return
      }

      const url = `/api/user/ebrigade-prestations?email=${encodeURIComponent(userEmail)}&dDebut=${dateFrom}&dFin=${dateTo}`
      console.log('[eBrigade] Fetching:', url)

      const res = await fetch(url, { credentials: 'include' })
      console.log('[eBrigade] Response:', res.status)

      if (!res.ok) {
        if (res.status === 400) {
          setError('Not linked to eBrigade')
        } else if (res.status === 401) {
          setError('Not authenticated')
        } else {
          setError(`Error ${res.status}`)
        }
        setLoading(false)
        return
      }

      const data = await res.json()
      console.log('[eBrigade] Data:', data)

      if (data.prestations && Array.isArray(data.prestations)) {
        setPrestations(data.prestations)
      }
    } catch (err) {
      console.error('[eBrigade] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-card card">
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Vos gardes eBrigade</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={loadPrestations}
          style={{ padding: '8px 16px', background: '#0366d6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Charger
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', padding: 12, marginBottom: 12 }}>Erreur: {error}</div>}
      {loading && <div style={{ color: '#666', padding: 12 }}>Chargement...</div>}
      {!loading && prestations.length === 0 && !error && <div style={{ color: '#999', padding: 12 }}>Aucune prestation</div>}

      {!loading && prestations.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Date</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Activité</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Début</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Fin</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Durée</th>
            </tr>
          </thead>
          <tbody>
            {prestations.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 10 }}>{p.date}</td>
                <td style={{ padding: 10, fontSize: 12 }}>{p.activity}</td>
                <td style={{ padding: 10 }}>{p.startTime}</td>
                <td style={{ padding: 10 }}>{p.endTime}</td>
                <td style={{ padding: 10 }}>{p.duration}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
