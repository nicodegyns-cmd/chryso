import React, { useState, useEffect } from 'react'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function pad(n) { return String(n).padStart(2, '0') }

export default function PharmacienStatistics() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(0) // 0 = toute l'année
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ year })
    if (month > 0) params.set('month', pad(month))
    fetch(`/api/admin/statistics/pharmacien?${params}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Erreur') }))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [year, month])

  const years = []
  for (let y = currentYear; y >= currentYear - 4; y--) years.push(y)

  const cardStyle = {
    background: '#f5f3ff',
    border: '1px solid #e9d5ff',
    borderRadius: 12,
    padding: '18px 22px',
    textAlign: 'center',
    minWidth: 140,
  }

  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Année</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#fff' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Mois</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#fff' }}>
            <option value={0}>Toute l'année</option>
            {MONTHS_FR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={{ color: '#6b7280', padding: 20 }}>Chargement…</div>}
      {error && <div style={{ color: '#ef4444', padding: 12, background: '#fee2e2', borderRadius: 8 }}>{error}</div>}

      {!loading && !error && data && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#7e22ce' }}>{data.summary.total_hours}h</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>Heures totales</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#7e22ce' }}>{data.summary.total_days}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>Jours travaillés</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#7e22ce' }}>{data.summary.total_pharmaciens}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>Pharmaciens actifs</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#7e22ce' }}>{data.summary.avg_hours_per_day}h</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>Moy. h/jour</div>
            </div>
          </div>

          {/* Par pharmacien */}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>Par pharmacien</h3>
          {data.by_user.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 14, padding: '12px 0' }}>Aucune donnée pour cette période</div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: 28 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f5f3ff' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Pharmacien</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Analytique</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Heures</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Jours</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Moy. h/jour</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_user.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#faf5ff' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.full_name}</td>
                      <td style={{ padding: '10px 14px', color: '#7e22ce', fontSize: 13 }}>{row.analytic_name || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{row.total_hours}h</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.total_days}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280' }}>{row.avg_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Par mois (si année entière) */}
          {month === 0 && data.by_month && data.by_month.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>Répartition mensuelle</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f5f3ff' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Mois</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Heures</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Jours</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Pharmaciens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_month.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#faf5ff' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{MONTHS_FR[Number(row.month) - 1]}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{row.total_hours}h</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.total_days}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.pharmaciens_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Par analytique */}
          {data.by_analytic && data.by_analytic.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: '28px 0 12px' }}>Par analytique</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f5f3ff' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Analytique</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Heures</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Jours</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#5b21b6', borderBottom: '2px solid #e9d5ff' }}>Pharmaciens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_analytic.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#faf5ff' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#7e22ce' }}>{row.analytic_name || '—'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{row.total_hours}h</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.total_days}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.pharmaciens_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
