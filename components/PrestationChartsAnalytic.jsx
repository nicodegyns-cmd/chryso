import React, { useEffect, useState, useMemo } from 'react'

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'
]

export default function PrestationChartsAnalytic() {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metric, setMetric] = useState('count') // 'count' | 'hours' | 'amount'
  const [viewMode, setViewMode] = useState('byAnalytic') // 'byAnalytic' | 'byUser' | 'nightWeekend'
  const [filters, setFilters] = useState({
    startMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    endMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    role: ''
  })

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

  useEffect(() => { fetchData() }, [filters])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.startMonth) params.append('startMonth', filters.startMonth)
      if (filters.endMonth) params.append('endMonth', filters.endMonth)
      if (filters.role) params.append('role', filters.role)
      const r = await fetch('/api/admin/statistics/invoices?' + params.toString())
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const d = await r.json()
      setRawData(d.prestations || [])
    } catch (e) {
      setError(e.message)
      setRawData(null)
    } finally {
      setLoading(false)
    }
  }

  // Build grouped data: { analyticName -> { userName -> { count, hours, amount, role, color } } }
  const grouped = useMemo(() => {
    if (!rawData) return null
    const analytics = {}
    const userColorMap = {}
    let userColorIdx = 0

    rawData.forEach(p => {
      const aname = p.analytic_name || 'Sans analytique'
      const fname = [p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || 'Inconnu'
      const uid = String(p.user_id || p.user_email || 'unknown')
      const userRole = p.user_role || ''

      if (!userColorMap[uid]) {
        userColorMap[uid] = COLORS[userColorIdx % COLORS.length]
        userColorIdx++
      }

      if (!analytics[aname]) analytics[aname] = { users: {}, total: { count: 0, hours: 0, amount: 0 } }

      if (!analytics[aname].users[uid]) {
        analytics[aname].users[uid] = { name: fname, role: userRole, count: 0, hours: 0, amount: 0, color: userColorMap[uid] }
      }

      const role = p.user_role
      let amount = 0
      if (role === 'MED') amount = parseFloat(p.remuneration_med || 0)
      else if (role === 'INFI') amount = parseFloat(p.remuneration_infi || 0)
      else amount = Math.max(parseFloat(p.remuneration_infi || 0), parseFloat(p.remuneration_med || 0))

      const gardeH = parseFloat(p.garde_hours || 0)
      const sortieH = parseFloat(p.sortie_hours || 0)
      const hours = (gardeH > 0 || sortieH > 0) ? gardeH + sortieH : parseFloat(p.hours_actual || 0)

      analytics[aname].users[uid].count += 1
      analytics[aname].users[uid].hours += hours
      analytics[aname].users[uid].amount += amount
      analytics[aname].total.count += 1
      analytics[aname].total.hours += hours
      analytics[aname].total.amount += amount
    })

    // Sort analytics by total desc
    return Object.entries(analytics)
      .sort((a, b) => b[1].total[metric] - a[1].total[metric])
      .map(([name, data]) => ({
        name,
        total: data.total,
        users: Object.values(data.users).sort((a, b) => b[metric] - a[metric])
      }))
  }, [rawData, metric])

  // Build by-user data: { userName -> { analytics: { name -> { count, hours, amount } }, total, role, color } }
  const groupedByUser = useMemo(() => {
    if (!rawData) return null
    const users = {}
    const userColorMap = {}
    let userColorIdx = 0

    rawData.forEach(p => {
      const aname = p.analytic_name || 'Sans analytique'
      const fname = [p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || 'Inconnu'
      const uid = String(p.user_id || p.user_email || 'unknown')

      if (!userColorMap[uid]) {
        userColorMap[uid] = COLORS[userColorIdx % COLORS.length]
        userColorIdx++
      }

      if (!users[uid]) users[uid] = { name: fname, role: p.user_role || '', color: userColorMap[uid], analytics: {}, total: { count: 0, hours: 0, amount: 0 } }

      if (!users[uid].analytics[aname]) users[uid].analytics[aname] = { count: 0, hours: 0, amount: 0 }

      const role = p.user_role
      let amount = 0
      if (role === 'MED') amount = parseFloat(p.remuneration_med || 0)
      else if (role === 'INFI') amount = parseFloat(p.remuneration_infi || 0)
      else amount = Math.max(parseFloat(p.remuneration_infi || 0), parseFloat(p.remuneration_med || 0))

      const gardeH = parseFloat(p.garde_hours || 0)
      const sortieH = parseFloat(p.sortie_hours || 0)
      const hours = (gardeH > 0 || sortieH > 0) ? gardeH + sortieH : parseFloat(p.hours_actual || 0)

      users[uid].analytics[aname].count += 1
      users[uid].analytics[aname].hours += hours
      users[uid].analytics[aname].amount += amount
      users[uid].total.count += 1
      users[uid].total.hours += hours
      users[uid].total.amount += amount
    })

    return Object.values(users).sort((a, b) => b.total[metric] - a.total[metric])
  }, [rawData, metric])

  // ── Night & Weekend detection ──────────────────────────────────────
  const isNight = (p) => {
    const name = (p.ebrigade_activity_name || p.analytic_name || '').toLowerCase()
    const type = (p.pay_type || '').toLowerCase()
    if (name.includes('nuit') || type.includes('nuit')) return true
    if (p.ebrigade_start_time) {
      const h = parseInt((p.ebrigade_start_time || '').split(':')[0] || '-1', 10)
      if (!isNaN(h) && (h >= 22 || h < 6)) return true
    }
    return false
  }
  const isWeekend = (p) => {
    if (!p.date) return false
    const dateStr = String(p.date).split('T')[0]
    const d = new Date(dateStr + 'T12:00:00')
    return d.getDay() === 0 || d.getDay() === 6
  }

  // ── Night & Weekend grouped stats (by user) ────────────────────────
  const nightWeekendGrouped = useMemo(() => {
    if (!rawData) return null
    const byUser = {}
    let totCount = 0, totNight = 0, totWeekend = 0, totBoth = 0

    rawData.forEach(p => {
      const uid = String(p.user_id || p.user_email || 'unknown')
      const fname = [p.user_first_name, p.user_last_name].filter(Boolean).join(' ') || p.user_email || 'Inconnu'
      const role = p.user_role || ''
      const night = isNight(p)
      const weekend = isWeekend(p)
      if (!byUser[uid]) byUser[uid] = { name: fname, role, count: 0, night: 0, weekend: 0, both: 0, normal: 0 }
      byUser[uid].count++
      totCount++
      if (night && weekend) { byUser[uid].both++; totBoth++ }
      else if (night) { byUser[uid].night++; totNight++ }
      else if (weekend) { byUser[uid].weekend++; totWeekend++ }
      else { byUser[uid].normal++ }
    })

    const sorted = Object.values(byUser)
      .sort((a, b) => (b.night + b.weekend + b.both) - (a.night + a.weekend + a.both))

    return { total: { count: totCount, night: totNight, weekend: totWeekend, both: totBoth, normal: totCount - totNight - totWeekend - totBoth }, byUser: sorted }
  }, [rawData])

  const fmt = (n) => (typeof n === 'number' ? n : 0).toFixed(2) + ' €'
  const fmtH = (n) => (typeof n === 'number' ? n : 0).toFixed(1) + ' h'
  const fmtVal = (v) => metric === 'count' ? v : metric === 'hours' ? fmtH(v) : fmt(v)

  const selectStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* FILTERS */}
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>De (mois)</span>
            <select value={filters.startMonth} onChange={e => setFilters({ ...filters, startMonth: e.target.value })} style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>À (mois)</span>
            <select value={filters.endMonth} onChange={e => setFilters({ ...filters, endMonth: e.target.value })} style={selectStyle}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Rôle</span>
            <select value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value })} style={selectStyle}>
              <option value="">Tous</option>
              <option value="INFI">Infirmier</option>
              <option value="MED">Médecin</option>
            </select>
          </label>

          {/* Metric toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Afficher</span>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
              {[['count', 'Prestations'], ['hours', 'Heures'], ['amount', 'Montant']].map(([val, lbl]) => (
                <button key={val} onClick={() => setMetric(val)} style={{
                  padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: metric === val ? '#4f46e5' : '#fff',
                  color: metric === val ? '#fff' : '#374151',
                  borderRight: val !== 'amount' ? '1px solid #d1d5db' : 'none'
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Vue</span>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
              {[['byAnalytic', 'Par analytique'], ['byUser', 'Par personnel'], ['nightWeekend', '🌙 Nuit & WE']].map(([val, lbl], i, arr) => (
                <button key={val} onClick={() => setViewMode(val)} style={{
                  padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: viewMode === val ? '#10b981' : '#fff',
                  color: viewMode === val ? '#fff' : '#374151',
                  borderRight: i < arr.length - 1 ? '1px solid #d1d5db' : 'none'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Chargement…</div>}
      {error && <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>Erreur : {error}</div>}

      {/* ── VUE PAR ANALYTIQUE ─────────────────────────────────────── */}
      {!loading && grouped && viewMode === 'byAnalytic' && (
        grouped.length === 0
          ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Aucune prestation trouvée.</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 16 }}>
              {grouped.map((analytic) => {
                const maxVal = Math.max(...analytic.users.map(u => u[metric]), 1)
                return (
                  <div key={analytic.name} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{analytic.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {analytic.users.length} prestataire(s) · total : <strong>{fmtVal(analytic.total[metric])}</strong>
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: '#eff6ff', color: '#1d4ed8'
                      }}>
                        {analytic.total.count} presta
                      </div>
                    </div>

                    {/* Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analytic.users.map((u, i) => {
                        const pct = Math.round((u[metric] / maxVal) * 100)
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{
                                display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                                background: u.role === 'INFI' ? '#dbeafe' : u.role === 'MED' ? '#fed7aa' : '#f3f4f6',
                                color: u.role === 'INFI' ? '#1d4ed8' : u.role === 'MED' ? '#92400e' : '#374151',
                                flexShrink: 0
                              }}>{u.role || '?'}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: u.color, flexShrink: 0 }}>{fmtVal(u[metric])}</span>
                            </div>
                            <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: pct + '%', background: u.color,
                                borderRadius: 5, transition: 'width 0.4s ease'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
      )}

      {/* ── VUE PAR PERSONNEL ──────────────────────────────────────── */}
      {!loading && groupedByUser && viewMode === 'byUser' && (
        groupedByUser.length === 0
          ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Aucune prestation trouvée.</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 16 }}>
              {groupedByUser.map((user) => {
                const analyticEntries = Object.entries(user.analytics).sort((a, b) => b[1][metric] - a[1][metric])
                const maxVal = Math.max(...analyticEntries.map(([, v]) => v[metric]), 1)
                const analyticColors = [
                  '#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ef4444',
                  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'
                ]
                return (
                  <div key={user.name} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: user.role === 'INFI' ? '#dbeafe' : user.role === 'MED' ? '#fed7aa' : '#f3f4f6',
                            color: user.role === 'INFI' ? '#1d4ed8' : user.role === 'MED' ? '#92400e' : '#374151',
                          }}>{user.role || '?'}</span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{user.name}</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {analyticEntries.length} activité(s) · total : <strong>{fmtVal(user.total[metric])}</strong>
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: '#f0fdf4', color: '#065f46'
                      }}>
                        {user.total.count} presta
                      </div>
                    </div>

                    {/* Bars per analytic */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analyticEntries.map(([aname, v], i) => {
                        const pct = Math.round((v[metric] / maxVal) * 100)
                        const color = analyticColors[i % analyticColors.length]
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aname}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: color, flexShrink: 0 }}>{fmtVal(v[metric])}</span>
                            </div>
                            <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: pct + '%', background: color,
                                borderRadius: 5, transition: 'width 0.4s ease'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
      )}
      {/* ── VUE NUIT & WEEK-END ───────────────────────────────────────── */}
      {!loading && nightWeekendGrouped && viewMode === 'nightWeekend' && (
        nightWeekendGrouped.byUser.length === 0
          ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Aucune prestation trouvée.</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 16 }}>
              {/* Card Nuit */}
              {(() => {
                const nightUsers = nightWeekendGrouped.byUser.filter(u => u.night + u.both > 0).sort((a, b) => (b.night + b.both) - (a.night + a.both))
                const maxVal = Math.max(...nightUsers.map(u => u.night + u.both), 1)
                return (
                  <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Gardes de nuit</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {nightUsers.length} prestataire(s) · total : <strong>{nightWeekendGrouped.total.night + nightWeekendGrouped.total.both}</strong>
                        </div>
                      </div>
                      <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f5f3ff', color: '#6d28d9' }}>
                        {nightWeekendGrouped.total.night + nightWeekendGrouped.total.both} nuits
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {nightUsers.map((u, i) => {
                        const val = u.night + u.both
                        const pct = Math.round((val / maxVal) * 100)
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{
                                display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, flexShrink: 0,
                                background: u.role === 'INFI' ? '#dbeafe' : u.role === 'MED' ? '#fed7aa' : '#f3f4f6',
                                color: u.role === 'INFI' ? '#1d4ed8' : u.role === 'MED' ? '#92400e' : '#374151',
                              }}>{u.role || '?'}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', flexShrink: 0 }}>{val}</span>
                            </div>
                            <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: '#8b5cf6', borderRadius: 5, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Card Week-end */}
              {(() => {
                const weUsers = nightWeekendGrouped.byUser.filter(u => u.weekend + u.both > 0).sort((a, b) => (b.weekend + b.both) - (a.weekend + a.both))
                const maxVal = Math.max(...weUsers.map(u => u.weekend + u.both), 1)
                return (
                  <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Gardes de week-end</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {weUsers.length} prestataire(s) · total : <strong>{nightWeekendGrouped.total.weekend + nightWeekendGrouped.total.both}</strong>
                        </div>
                      </div>
                      <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#fff7ed', color: '#c2410c' }}>
                        {nightWeekendGrouped.total.weekend + nightWeekendGrouped.total.both} WE
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {weUsers.map((u, i) => {
                        const val = u.weekend + u.both
                        const pct = Math.round((val / maxVal) * 100)
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{
                                display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, flexShrink: 0,
                                background: u.role === 'INFI' ? '#dbeafe' : u.role === 'MED' ? '#fed7aa' : '#f3f4f6',
                                color: u.role === 'INFI' ? '#1d4ed8' : u.role === 'MED' ? '#92400e' : '#374151',
                              }}>{u.role || '?'}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316', flexShrink: 0 }}>{val}</span>
                            </div>
                            <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: '#f97316', borderRadius: 5, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
      )}
    </div>
  )
}
