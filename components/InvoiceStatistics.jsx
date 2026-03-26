import React, { useEffect, useState, useMemo } from 'react'

export default function InvoiceStatistics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    startMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    endMonth: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    role: '', // empty = all, 'INFI', 'MED'
    userId: '', // empty = all
    analyticId: '' // empty = all
  })

  useEffect(() => {
    fetchStatistics()
  }, [filters])

  async function fetchStatistics() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startMonth) params.append('startMonth', filters.startMonth)
      if (filters.endMonth) params.append('endMonth', filters.endMonth)
      if (filters.role) params.append('role', filters.role)
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.analyticId) params.append('analyticId', filters.analyticId)
      
      const r = await fetch('/api/admin/statistics/invoices?' + params.toString())
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setData(d)
    } catch (e) {
      console.error('fetch statistics failed', e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    // Prefer prestations (detailed remuneration), fallback to invoices (amounts)
    if (!data) return { byUser: [], byRole: {}, total: 0 }

    if (data.prestations && data.prestations.length > 0) {
      // Existing behaviour for prestations
      const userMap = {}
      data.prestations.forEach(p => {
        const userId = p.user_id
        const name = p.user_firstName && p.user_lastName 
          ? `${p.user_firstName} ${p.user_lastName}`
          : (p.user_email || 'Unknown')
        const role = p.user_role || 'Unknown'

        if (!userMap[userId]) {
          userMap[userId] = { id: userId, name, role, total: 0, count: 0, details: [] }
        }

        const amount = (p.remuneration_infi || 0) + (p.remuneration_med || 0)
        userMap[userId].total += amount
        userMap[userId].count += 1
        userMap[userId].details.push({ date: p.date, type: p.pay_type, amount, infi: p.remuneration_infi || 0, med: p.remuneration_med || 0 })
      })

      const byRole = { INFI: { total: 0, count: 0 }, MED: { total: 0, count: 0 } }
      data.prestations.forEach(p => {
        const role = p.user_role || 'Unknown'
        const amount = (p.remuneration_infi || 0) + (p.remuneration_med || 0)
        if (role === 'INFI' || role === 'MED') {
          if (!byRole[role]) byRole[role] = { total: 0, count: 0 }
          byRole[role].total += amount
          byRole[role].count += 1
        }
      })

      const userList = Object.values(userMap).sort((a, b) => b.total - a.total)
      const total = userList.reduce((sum, u) => sum + u.total, 0)
      return { byUser: userList, byRole, total }
    }

    if (data.invoices && data.invoices.length > 0) {
      // Fallback: aggregate invoices by user and role
      const userMap = {}
      data.invoices.forEach(inv => {
        const userId = inv.user_id || ('u' + (inv.user_email || 'unknown'))
        const name = [inv.user_first_name, inv.user_last_name].filter(Boolean).join(' ') || inv.user_email || inv.company_name || 'Unknown'
        const role = inv.user_role || 'Unknown'
        const amount = parseFloat(inv.amount) || 0

        if (!userMap[userId]) {
          userMap[userId] = { id: userId, name, role, total: 0, count: 0 }
        }
        userMap[userId].total += amount
        userMap[userId].count += 1
      })

      const byRole = {}
      Object.values(userMap).forEach(u => {
        const r = u.role || 'Unknown'
        if (!byRole[r]) byRole[r] = { total: 0, count: 0 }
        byRole[r].total += u.total
        byRole[r].count += u.count
      })

      const userList = Object.values(userMap).sort((a, b) => b.total - a.total)
      const total = userList.reduce((sum, u) => sum + u.total, 0)
      return { byUser: userList, byRole, total }
    }

    return { byUser: [], byRole: {}, total: 0 }
  }, [data])

  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState([])
  
  useEffect(() => {
    async function loadUsers() {
      try {
        const r = await fetch('/api/users')
        if (r.ok) {
          const d = await r.json()
          setUsers(d.items || [])
        }
      } catch (e) {
        console.error('load users failed', e)
      }
    }
    
    async function loadAnalytics() {
      try {
        const r = await fetch('/api/analytics')
        if (r.ok) {
          const d = await r.json()
          setAnalytics(d.items || [])
        }
      } catch (e) {
        console.error('load analytics failed', e)
      }
    }
    
    loadUsers()
    loadAnalytics()
  }, [])

  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      result.push({ value: `${year}-${month}`, label: d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) })
    }
    return result
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filters */}
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>🔍 Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>De (mois)</span>
            <select
              value={filters.startMonth}
              onChange={e => setFilters({ ...filters, startMonth: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>À (mois)</span>
            <select
              value={filters.endMonth}
              onChange={e => setFilters({ ...filters, endMonth: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Analytique</span>
            <select
              value={filters.analyticId}
              onChange={e => setFilters({ ...filters, analyticId: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">Tous</option>
              {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Rôle</span>
            <select
              value={filters.role}
              onChange={e => setFilters({ ...filters, role: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">Tous</option>
              <option value="INFI">Infirmier</option>
              <option value="MED">Médecin</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Utilisateur</span>
            <select
              value={filters.userId}
              onChange={e => setFilters({ ...filters, userId: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">Tous</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Chargement des statistiques…</div>}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, marginBottom: 8 }}>MONTANT TOTAL</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{stats.total.toFixed(2)} €</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{stats.byUser.length} personne(s)</div>
            </div>
            {stats.byRole.INFI && (
              <div style={{ padding: 16, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, marginBottom: 8 }}>INFIRMIERS</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{stats.byRole.INFI.total.toFixed(2)} €</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{stats.byRole.INFI.count} prestation(s)</div>
              </div>
            )}
            {stats.byRole.MED && (
              <div style={{ padding: 16, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, marginBottom: 8 }}>MÉDECINS</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{stats.byRole.MED.total.toFixed(2)} €</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{stats.byRole.MED.count} prestation(s)</div>
              </div>
            )}
          </div>

          {/* Breakdown by User */}
          <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>👥 Montants par utilisateur</h3>
            {stats.byUser.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune donnée pour cette période</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Utilisateur</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Rôle</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Prestations</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byUser.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}>
                      <td style={{ padding: 12, color: '#1f2937', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: u.role === 'INFI' ? '#dbeafe' : '#fed7aa', color: u.role === 'INFI' ? '#0366d6' : '#92400e', fontSize: 11, fontWeight: 600 }}>
                          {u.role === 'INFI' ? '🏥 Infi' : u.role === 'MED' ? '👨‍⚕️ Med' : u.role}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#6b7280' }}>{u.count}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: 14 }}>{u.total.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
