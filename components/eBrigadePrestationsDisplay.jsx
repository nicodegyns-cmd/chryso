import React, { useEffect, useState } from 'react'

export default function EBrigadePrestationsDisplay({ email, onSelectPrestation }) {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [prestations, setPrestations] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    setReady(true)
    // Set default date range (7 days from today)
    const today = new Date()
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const formatDate = (d) => d.toISOString().split('T')[0]
    setDateDebut(formatDate(today))
    setDateFin(formatDate(sevenDaysLater))
  }, [])

  const handleLoadPrestations = async () => {
    if (!email) {
      setError('Email non trouvé. Veuillez vous reconnecter.')
      return
    }

    if (!dateDebut || !dateFin) {
      setError('Veuillez sélectionner les deux dates.')
      return
    }

    setLoading(true)
    setError('')
    setPrestations([])

    try {
      const response = await fetch(`/api/user/ebrigade-prestations?email=${encodeURIComponent(email)}&dDebut=${dateDebut}&dFin=${dateFin}`)
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
      } else if (data.prestations && Array.isArray(data.prestations)) {
        setPrestations(data.prestations)
        if (data.prestations.length === 0) {
          setError('Aucune garde trouvée pour cette période.')
        }
      } else {
        setPrestations(data)
      }
    } catch (err) {
      setError(`Erreur: ${err.message}`)
      console.error('[EBRIGADE] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return null
  }

  return (
    <div className="admin-card card">
      <h3>📅 Vos gardes eBrigade</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9em', fontWeight: '500' }}>
            Début
          </label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 4, fontFamily: 'inherit'}}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9em', fontWeight: '500' }}>
            Fin
          </label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 4, fontFamily: 'inherit'}}
          />
        </div>

        <button
          onClick={handleLoadPrestations}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#ccc' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {loading ? 'Chargement...' : 'Charger'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 4, color: '#991b1b', marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {prestations.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Date</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Début</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Fin</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Durée (h)</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Activité</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {prestations.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 8 }}>{p.date}</td>
                  <td style={{ padding: 8 }}>{p.startTime}</td>
                  <td style={{ padding: 8 }}>{p.endTime}</td>
                  <td style={{ padding: 8 }}>{p.duration}</td>
                  <td style={{ padding: 8 }}>{p.activity}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (onSelectPrestation) {
                          onSelectPrestation(p)
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#0366d6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.85em'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#0260c8'}
                      onMouseLeave={(e) => e.target.style.background = '#0366d6'}
                    >
                      📝 Déclarer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
