import React, { useEffect, useState, useMemo } from 'react'

export default function InvoiceStatistics() {
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

  // Load users and analytics for filter dropdowns
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

  // Fetch stats when filters change
  useEffect(() => {
    fetchStatistics()
  }, [filters])

  async function fetchStatistics() {
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
    const rows = data.prestations

    let totalAmount = 0
    let totalHours = 0
    const byUser = {}
    const byAnalytic = {}
    const byStatus = {}
    const byRole = { INFI: { amount: 0, count: 0, hours: 0 }, MED: { amount: 0, count: 0, hours: 0 } }

    rows.forEach(p => {
      const amount = parseFloat(p.remuneration_infi || 0) + parseFloat(p.remuneration_med || 0)
      const hours = parseFloat(p.hours_actual || 0) + parseFloat(p.garde_hours || 0) + parseFloat(p.sortie_hours || 0)
      totalAmount += amount
      totalHours += hours

      // By user
      const uid = String(p.user_id || p.user_email || 'inconnu')
      const uname = [p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || 'Inconnu'
      if (!byUser[uid]) byUser[uid] = { name: uname, role: p.user_role, amount: 0, count: 0, hours: 0 }
      byUser[uid].amount += amount
      byUser[uid].count += 1
      byUser[uid].hours += hours

      // By analytic
      const aid = String(p.analytic_id || 'sans')
      const aname = p.analytic_name || 'Sans analytique'
      const overtime = parseFloat(p.overtime_hours || 0)
      if (!byAnalytic[aid]) byAnalytic[aid] = { name: aname, code: p.analytic_code || '', amount: 0, count: 0, hours: 0, overtime: 0, overtimeCount: 0 }
      byAnalytic[aid].amount += amount
      byAnalytic[aid].count += 1
      byAnalytic[aid].hours += hours
      byAnalytic[aid].overtime += overtime
      if (overtime > 0) byAnalytic[aid].overtimeCount += 1

      // By status
      const st = p.status || 'Inconnu'
      if (!byStatus[st]) byStatus[st] = { count: 0, amount: 0 }
      byStatus[st].count += 1
      byStatus[st].amount += amount

      // By role
      const role = p.user_role
      if (role === 'INFI' || role === 'MED') {
        byRole[role].amount += amount
        byRole[role].count += 1
        byRole[role].hours += hours
      }
    })

    const analyticList = Object.values(byAnalytic).sort((a, b) => b.amount - a.amount)
    const totalOvertime = analyticList.reduce((s, a) => s + a.overtime, 0)

    return {
      totalAmount,
      totalHours,
      totalOvertime,
      totalPrestations: rows.length,
      byUser: Object.values(byUser).sort((a, b) => b.amount - a.amount),
      byAnalytic: analyticList,
      byStatus,
      byRole
    }
  }, [data])

  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      result.push({
        value: year + '-' + month,
        label: d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      })
    }
    return result
  }, [])

  const fmt = (n) => (typeof n === 'number' ? n : 0).toFixed(2) + ' €'
  const fmtH = (n) => (typeof n === 'number' ? n : 0).toFixed(1) + ' h'

  const statusStyle = {
    'À saisir': { background: '#f3f4f6', color: '#374151' },
    'En attente d’approbation': { background: '#fef3c7', color: '#92400e' },
    'En attente d’envoie': { background: '#dbeafe', color: '#1d4ed8' },
    'Envoyé à la facturation': { background: '#d1fae5', color: '#065f46' },
    'Annulé': { background: '#fee2e2', color: '#991b1b' },
    'Payé': { background: '#ecfdf5', color: '#064e3b' },
  }

  const selectStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }
  const labelStyle = { display: 'flex', flexDirection: 'column' }
  const labelTextStyle = { fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* FILTERS */}
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>

          <label style={labelStyle}>
            <span style={labelTextStyle}>De (mois)</span>
            <select value={filters.startMonth}
              onChange={e => setFilters({ ...filters, startMonth: e.target.value })}
              style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>À (mois)</span>
            <select value={filters.endMonth}
              onChange={e => setFilters({ ...filters, endMonth: e.target.value })}
              style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Analytique</span>
            <select value={filters.analyticId}
              onChange={e => setFilters({ ...filters, analyticId: e.target.value })}
              style={selectStyle}>
              <option value="">Toutes</option>
              {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Rôle</span>
            <select value={filters.role}
              onChange={e => setFilters({ ...filters, role: e.target.value })}
              style={selectStyle}>
              <option value="">Tous</option>
              <option value="INFI">Infirmier</option>
              <option value="MED">Médecin</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Utilisateur</span>
            <select value={filters.userId}
              onChange={e => setFilters({ ...filters, userId: e.target.value })}
              style={selectStyle}>
              <option value="">Tous</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </label>

        </div>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
          Chargement…
        </div>
      )}

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          Erreur : {error}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* KPI CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 20, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Montant total
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(stats.totalAmount)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{stats.totalPrestations} prestation(s)</div>
            </div>

            <div style={{ padding: 20, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Heures totales
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{fmtH(stats.totalHours)}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{stats.byUser.length} prestataire(s)</div>
            </div>

            {stats.byRole.INFI.count > 0 && (
              <div style={{ padding: 20, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Infirmiers
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(stats.byRole.INFI.amount)}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {stats.byRole.INFI.count} prestation(s) · {fmtH(stats.byRole.INFI.hours)}
                </div>
              </div>
            )}

            {stats.byRole.MED.count > 0 && (
              <div style={{ padding: 20, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Médecins
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(stats.byRole.MED.amount)}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {stats.byRole.MED.count} prestation(s) · {fmtH(stats.byRole.MED.hours)}
                </div>
              </div>
            )}
          </div>

          {/* STATUS BREAKDOWN */}
          {Object.keys(stats.byStatus).length > 0 && (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
                Répartition par statut
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {Object.entries(stats.byStatus).sort((a, b) => b[1].count - a[1].count).map(([st, v]) => {
                  const style = statusStyle[st] || { background: '#f3f4f6', color: '#374151' }
                  return (
                    <div key={st} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, ...style }}>
                      {st}
                      <span style={{ marginLeft: 8, opacity: 0.75, fontWeight: 400 }}>
                        {v.count} · {fmt(v.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* BY ANALYTIC */}
          {stats.byAnalytic.length > 0 && (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
                Par analytique
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Analytique</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Prestations</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Heures</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byAnalytic.map((a, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>
                        {a.name}
                        {a.code && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{a.code}</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{a.count}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{fmtH(a.hours)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* OVERTIME BY ANALYTIC */}
          {stats.byAnalytic.some(a => a.overtime > 0) && (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
                  Heures supplémentaires par activité
                </h3>
                <span style={{ padding: '3px 10px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 700 }}>
                  Total : {fmtH(stats.totalOvertime)}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Activité</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Prestations avec HS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Heures sup</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Moy. / prestation</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>% des HS totales</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byAnalytic.filter(a => a.overtime > 0).map((a, i) => {
                    const pct = stats.totalOvertime > 0 ? (a.overtime / stats.totalOvertime * 100) : 0
                    const avg = a.overtimeCount > 0 ? a.overtime / a.overtimeCount : 0
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>
                          {a.name}
                          {a.code && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{a.code}</span>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                          {a.overtimeCount}
                          <span style={{ fontSize: 11, color: '#d1d5db', marginLeft: 4 }}>/ {a.count}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{fmtH(a.overtime)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{fmtH(avg)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <div style={{ width: 60, height: 6, background: '#fde68a', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: pct + '%', height: '100%', background: '#f59e0b', borderRadius: 4 }} />
                            </div>
                            <span style={{ color: '#92400e', fontWeight: 600, fontSize: 12 }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* BY USER */}
          <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
              Par prestataire
            </h3>
            {stats.byUser.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune donnée pour cette période.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Nom</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Rôle</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Prestations</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Heures</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byUser.map((u, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: u.role === 'INFI' ? '#dbeafe' : u.role === 'MED' ? '#fed7aa' : '#f3f4f6',
                          color: u.role === 'INFI' ? '#1d4ed8' : u.role === 'MED' ? '#92400e' : '#374151'
                        }}>
                          {u.role || '??'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{u.count}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{fmtH(u.hours)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: 14 }}>{fmt(u.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!loading && !error && data && data.prestations && data.prestations.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Aucune prestation trouvée pour cette période et ces filtres.
        </div>
      )}
    </div>
  )
}
