import React, { useEffect, useState, useMemo } from 'react'

export default function ExpenseStatistics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [filters, setFilters] = useState({
    startMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    endMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    role: '',
    userId: '',
    analyticId: ''
  })
  const [userSearch, setUserSearch] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsers(d.users || []) })
      .catch(() => {})
    fetch('/api/admin/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAnalytics(d.items || []) })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchData() }, [filters])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.startMonth) params.append('startMonth', filters.startMonth)
      if (filters.endMonth) params.append('endMonth', filters.endMonth)
      if (filters.role) params.append('role', filters.role)
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.analyticId) params.append('analyticId', filters.analyticId)
      const r = await fetch('/api/admin/statistics/invoices?' + params.toString())
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const d = await r.json()
      setData(d)
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (!data || !data.prestations) return null
    // Only rows with expense_amount > 0
    const rows = data.prestations.filter(p => parseFloat(p.expense_amount || 0) > 0)
    if (rows.length === 0) return { rows: [], total: 0, byUser: [], byAnalytic: [] }

    let total = 0
    const byUser = {}
    const byAnalytic = {}

    rows.forEach(p => {
      const exp = parseFloat(p.expense_amount || 0)
      total += exp

      const uid = String(p.user_id || p.user_email || 'inconnu')
      const uname = [p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || 'Inconnu'
      if (!byUser[uid]) byUser[uid] = { name: uname, role: p.user_role, total: 0, count: 0 }
      byUser[uid].total += exp
      byUser[uid].count += 1

      const aid = String(p.analytic_id || 'sans')
      const aname = p.analytic_name || 'Sans analytique'
      if (!byAnalytic[aid]) byAnalytic[aid] = { name: aname, code: p.analytic_code || '', total: 0, count: 0 }
      byAnalytic[aid].total += exp
      byAnalytic[aid].count += 1
    })

    return {
      rows,
      total,
      byUser: Object.values(byUser).sort((a, b) => b.total - a.total),
      byAnalytic: Object.values(byAnalytic).sort((a, b) => b.total - a.total)
    }
  }, [data])

  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        value: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
        label: d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      })
    }
    return result
  }, [])

  const fmt = (n) => (typeof n === 'number' ? n : 0).toFixed(2) + ' €'
  const selectStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }
  const labelStyle = { display: 'flex', flexDirection: 'column' }
  const labelTextStyle = { fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }

  const statusColors = {
    'À saisir': { background: '#f3f4f6', color: '#374151' },
    "En attente d'approbation": { background: '#fef3c7', color: '#92400e' },
    "En attente d'envoie": { background: '#dbeafe', color: '#1d4ed8' },
    'Envoyé à la facturation': { background: '#d1fae5', color: '#065f46' },
    'Annulé': { background: '#fee2e2', color: '#991b1b' },
    'Payé': { background: '#ecfdf5', color: '#064e3b' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* FILTERS */}
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>De (mois)</span>
            <select value={filters.startMonth} onChange={e => setFilters({ ...filters, startMonth: e.target.value })} style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>À (mois)</span>
            <select value={filters.endMonth} onChange={e => setFilters({ ...filters, endMonth: e.target.value })} style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Analytique</span>
            <select value={filters.analyticId} onChange={e => setFilters({ ...filters, analyticId: e.target.value })} style={selectStyle}>
              <option value="">Toutes</option>
              {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Rôle</span>
            <select value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value })} style={selectStyle}>
              <option value="">Tous</option>
              <option value="INFI">Infirmier</option>
              <option value="MED">Médecin</option>
            </select>
          </label>
          <div style={labelStyle}>
            <span style={labelTextStyle}>Utilisateur</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Rechercher un nom…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserDropdownOpen(true); if (!e.target.value) setFilters({ ...filters, userId: '' }) }}
                onFocus={() => setUserDropdownOpen(true)}
                onBlur={() => setTimeout(() => setUserDropdownOpen(false), 150)}
                style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }}
              />
              {userDropdownOpen && (() => {
                const q = userSearch.toLowerCase()
                const filtered = users.filter(u => !q || (u.first_name + ' ' + u.last_name).toLowerCase().includes(q))
                return filtered.length > 0 ? (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
                    <div onMouseDown={() => { setFilters({ ...filters, userId: '' }); setUserSearch(''); setUserDropdownOpen(false) }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>Tous</div>
                    {filtered.map(u => (
                      <div key={u.id} onMouseDown={() => { setFilters({ ...filters, userId: u.id }); setUserSearch(u.first_name + ' ' + u.last_name); setUserDropdownOpen(false) }}
                        style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', background: filters.userId === String(u.id) ? '#eff6ff' : '#fff', color: filters.userId === String(u.id) ? '#1d4ed8' : '#1f2937', borderBottom: '1px solid #f3f4f6' }}>
                        {u.first_name} {u.last_name}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Chargement…</div>}
      {error && <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>Erreur : {error}</div>}

      {!loading && stats && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 20, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total notes de frais</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(stats.total)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{stats.rows.length} prestation(s) avec frais</div>
            </div>
            <div style={{ padding: 20, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prestataires concernés</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.byUser.length}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{stats.byAnalytic.length} analytique(s) concernée(s)</div>
            </div>
            {stats.rows.length > 0 && (
              <div style={{ padding: 20, background: 'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Montant moyen / frais</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(stats.total / stats.rows.length)}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>par prestation avec frais</div>
              </div>
            )}
          </div>

          {stats.rows.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Aucune note de frais pour cette période et ces filtres.</div>
          ) : (
            <>
              {/* PAR PRESTATAIRE */}
              <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Par prestataire</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Nom</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Rôle</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Nb frais</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Total frais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.map((u, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{u.name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: u.role === 'INFI' ? '#dbeafe' : u.role === 'MED' ? '#fed7aa' : '#f3f4f6', color: u.role === 'INFI' ? '#1d4ed8' : u.role === 'MED' ? '#92400e' : '#374151' }}>
                            {u.role || '??'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{u.count}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706', fontSize: 14 }}>{fmt(u.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAR ANALYTIQUE */}
              <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Par analytique</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Analytique</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Nb frais</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byAnalytic.map((a, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>
                          {a.name}
                          {a.code && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>{a.code}</span>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{a.count}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{fmt(a.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DETAIL */}
              <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Détail des notes de frais</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Prestataire</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Analytique</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Montant</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Raison</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Statut</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1f2937' }}>Justificatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rows.map((p, i) => {
                      const sStyle = statusColors[p.status] || { background: '#f3f4f6', color: '#374151' }
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                          <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>
                            {[p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#6b7280' }}>{p.analytic_name || '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                            {fmt(parseFloat(p.expense_amount || 0))}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 200 }}>
                            {p.expense_comment || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, ...sStyle }}>
                              {p.status || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {p.proof_image ? (
                              <a href={p.proof_image} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706', fontWeight: 600, fontSize: 12 }}>📎 Voir</a>
                            ) : (
                              <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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
