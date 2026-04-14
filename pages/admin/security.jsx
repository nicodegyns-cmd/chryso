import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function SecurityPage() {
  const [tab, setTab] = useState('ips') // 'ips' | 'invitations'

  // --- IP blocking state ---
  const [blockedIps, setBlockedIps] = useState([])
  const [ipLoading, setIpLoading] = useState(true)
  const [newIp, setNewIp] = useState('')
  const [newReason, setNewReason] = useState('')
  const [ipBusy, setIpBusy] = useState(false)

  // --- Invitation exclusions state ---
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [toggling, setToggling] = useState({})

  useEffect(() => {
    fetchBlockedIps()
    fetchUsers()
  }, [])

  async function fetchBlockedIps() {
    setIpLoading(true)
    try {
      const r = await fetch('/api/admin/blocked-ips')
      const d = await r.json()
      setBlockedIps(Array.isArray(d) ? d : [])
    } catch (e) { setBlockedIps([]) }
    finally { setIpLoading(false) }
  }

  async function addIp() {
    if (!newIp.trim()) return
    setIpBusy(true)
    try {
      const r = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: newIp.trim(), reason: newReason.trim() || null })
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erreur') }
      setNewIp(''); setNewReason('')
      await fetchBlockedIps()
    } catch (e) { alert('Erreur: ' + e.message) }
    finally { setIpBusy(false) }
  }

  async function removeIp(ip) {
    if (!confirm(`Débloquer l'IP ${ip} ?`)) return
    try {
      const r = await fetch('/api/admin/blocked-ips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: ip })
      })
      if (!r.ok) throw new Error('Erreur')
      await fetchBlockedIps()
    } catch (e) { alert('Erreur: ' + e.message) }
  }

  async function fetchUsers() {
    setUsersLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      const d = await r.json()
      setUsers(d.users || [])
    } catch (e) { setUsers([]) }
    finally { setUsersLoading(false) }
  }

  async function toggleExclusion(user) {
    setToggling(t => ({ ...t, [user.id]: true }))
    try {
      const r = await fetch(`/api/admin/users/${user.id}/toggle-invitation-excluded`, { method: 'POST' })
      if (!r.ok) throw new Error('Erreur')
      const d = await r.json()
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, invitation_excluded: d.invitation_excluded } : u))
    } catch (e) { alert('Erreur: ' + e.message) }
    finally { setToggling(t => ({ ...t, [user.id]: false })) }
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true
    const q = userSearch.toLowerCase()
    return (u.first_name || '').toLowerCase().includes(q) ||
           (u.last_name || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q)
  })

  return (
    <div className="admin-layout">
      <AdminHeader />
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main">
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 6 }}>🔒 Sécurité</h1>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Bloquer des adresses IP et gérer les exclusions d'invitation</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
            {[
              { key: 'ips', label: '🚫 IPs bloquées' },
              { key: 'invitations', label: '📧 Exclusions d\'invitation' }
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
                color: tab === t.key ? '#1d4ed8' : '#6b7280',
                borderBottom: tab === t.key ? '2px solid #1d4ed8' : '2px solid transparent',
                marginBottom: -2
              }}>{t.label}</button>
            ))}
          </div>

          {/* ===== IP BLOCKING ===== */}
          {tab === 'ips' && (
            <div>
              {/* Add form */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Bloquer une nouvelle IP</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Adresse IP *</label>
                    <input
                      value={newIp} onChange={e => setNewIp(e.target.value)}
                      placeholder="ex: 192.168.1.1"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 200 }}
                      onKeyDown={e => e.key === 'Enter' && addIp()}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Raison (optionnel)</label>
                    <input
                      value={newReason} onChange={e => setNewReason(e.target.value)}
                      placeholder="ex: Tentatives d'intrusion"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 260 }}
                      onKeyDown={e => e.key === 'Enter' && addIp()}
                    />
                  </div>
                  <button onClick={addIp} disabled={ipBusy || !newIp.trim()} style={{
                    padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                    fontWeight: 600, cursor: ipBusy || !newIp.trim() ? 'not-allowed' : 'pointer', opacity: (!newIp.trim()) ? 0.5 : 1
                  }}>
                    {ipBusy ? '…' : '🚫 Bloquer'}
                  </button>
                </div>
              </div>

              {/* List */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
                  IPs bloquées ({blockedIps.length})
                </div>
                {ipLoading ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Chargement…</div>
                ) : blockedIps.length === 0 ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>✅ Aucune IP bloquée</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Adresse IP</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Raison</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Bloquée par</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedIps.map(row => (
                        <tr key={row.ip_address} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{row.ip_address}</td>
                          <td style={{ padding: '10px 16px', color: '#374151', fontSize: 13 }}>{row.reason || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 13 }}>{row.blocked_by || 'admin'}</td>
                          <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>
                            {row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button onClick={() => removeIp(row.ip_address)} style={{
                              padding: '5px 12px', background: '#fee2e2', color: '#dc2626',
                              border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}>Débloquer</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ===== INVITATION EXCLUSIONS ===== */}
          {tab === 'invitations' && (
            <div>
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: '#856404' }}>
                ⚠️ Les utilisateurs marqués comme <strong>exclus</strong> ne recevront pas d'invitation lors de la synchronisation eBrigade ni lors des envois d'invitations en masse.
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input
                    value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    placeholder="Rechercher un utilisateur…"
                    style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, flex: 1, maxWidth: 300 }}
                  />
                  <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {filteredUsers.filter(u => u.invitation_excluded).length} exclus · {filteredUsers.length} utilisateurs
                  </span>
                </div>
                {usersLoading ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Chargement…</div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Aucun utilisateur trouvé</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Utilisateur</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Rôle</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Exclure des invitations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', background: u.invitation_excluded ? '#fff7ed' : 'white' }}>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{u.first_name || ''} {u.last_name || ''}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{u.role || '—'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleExclusion(u)}
                              disabled={!!toggling[u.id]}
                              style={{
                                padding: '6px 14px',
                                background: u.invitation_excluded ? '#fee2e2' : '#f0fdf4',
                                color: u.invitation_excluded ? '#dc2626' : '#16a34a',
                                border: `1px solid ${u.invitation_excluded ? '#fca5a5' : '#bbf7d0'}`,
                                borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                opacity: toggling[u.id] ? 0.5 : 1
                              }}
                            >
                              {toggling[u.id] ? '…' : (u.invitation_excluded ? '🚫 Exclu' : '✅ Inclus')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
