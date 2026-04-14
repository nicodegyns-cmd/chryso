import React, { useState, useEffect } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function SecurityPage() {
  const [tab, setTab] = useState('ips') // 'ips' | 'invitations' | 'emails'

  // --- IP blocking ---
  const [blockedIps, setBlockedIps] = useState([])
  const [ipLoading, setIpLoading] = useState(true)
  const [newIp, setNewIp] = useState('')
  const [newReason, setNewReason] = useState('')
  const [ipBusy, setIpBusy] = useState(false)

  // --- Invitation exclusions (users with profile) ---
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [toggling, setToggling] = useState({})

  // --- Excluded emails (no profile yet) ---
  const [excludedEmails, setExcludedEmails] = useState([])
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [newExcEmail, setNewExcEmail] = useState('')
  const [newExcReason, setNewExcReason] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  useEffect(() => {
    fetchBlockedIps()
    fetchUsers()
    fetchExcludedEmails()
  }, [])

  // ---- IP functions ----
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

  // ---- User exclusion functions ----
  async function fetchUsers() {
    setUsersLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      const d = await r.json()
      setUsers(Array.isArray(d) ? d : (d.users || []))
    } catch (e) { setUsers([]) }
    finally { setUsersLoading(false) }
  }

  async function toggleExclusion(user) {
    setToggling(prev => ({ ...prev, [user.id]: true }))
    try {
      const r = await fetch(`/api/admin/users/${user.id}/toggle-invitation-excluded`, { method: 'POST' })
      if (!r.ok) throw new Error('Erreur')
      const d = await r.json()
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, invitation_excluded: d.invitation_excluded } : u))
    } catch (e) { alert('Erreur: ' + e.message) }
    finally { setToggling(prev => ({ ...prev, [user.id]: false })) }
  }

  // ---- Excluded email functions ----
  async function fetchExcludedEmails() {
    setEmailsLoading(true)
    try {
      const r = await fetch('/api/admin/excluded-emails')
      const d = await r.json()
      setExcludedEmails(Array.isArray(d) ? d : [])
    } catch (e) { setExcludedEmails([]) }
    finally { setEmailsLoading(false) }
  }

  async function addExcludedEmail() {
    if (!newExcEmail.trim() || !newExcEmail.includes('@')) return
    setEmailBusy(true)
    try {
      const r = await fetch('/api/admin/excluded-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newExcEmail.trim(), reason: newExcReason.trim() || null })
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erreur') }
      setNewExcEmail(''); setNewExcReason('')
      await fetchExcludedEmails()
    } catch (e) { alert('Erreur: ' + e.message) }
    finally { setEmailBusy(false) }
  }

  async function removeExcludedEmail(email) {
    if (!confirm(`Réautoriser les invitations pour ${email} ?`)) return
    try {
      const r = await fetch('/api/admin/excluded-emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!r.ok) throw new Error('Erreur')
      await fetchExcludedEmails()
    } catch (e) { alert('Erreur: ' + e.message) }
  }

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return !q || (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
  })

  const tabs = [
    { key: 'ips', label: '🚫 IPs bloquées' },
    { key: 'invitations', label: '📧 Exclusions (avec compte)' },
    { key: 'emails', label: '✉️ Exclusions (sans compte)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f3f4f6' }}>
      <AdminHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <AdminSidebar />
        <main style={{ flex: 1, padding: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>🔒 Sécurité</h1>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? '#2563eb' : '#6b7280',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, fontSize: 14
              }}>{t.label}</button>
            ))}
          </div>

          {/* ===== IPs bloquées ===== */}
          {tab === 'ips' && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Bloquer une adresse IP</div>
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
                      placeholder="ex: Tentative de brute force"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 260 }}
                      onKeyDown={e => e.key === 'Enter' && addIp()}
                    />
                  </div>
                  <button onClick={addIp} disabled={ipBusy || !newIp.trim()} style={{
                    padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                    fontWeight: 600, cursor: ipBusy || !newIp.trim() ? 'not-allowed' : 'pointer',
                    opacity: !newIp.trim() ? 0.5 : 1
                  }}>
                    {ipBusy ? '…' : '🚫 Bloquer'}
                  </button>
                </div>
              </div>
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
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>IP</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Raison</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedIps.map(ip => (
                        <tr key={ip.ip_address} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>{ip.ip_address}</td>
                          <td style={{ padding: '10px 16px', color: '#374151', fontSize: 13 }}>{ip.reason || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>
                            {ip.created_at ? new Date(ip.created_at).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button onClick={() => removeIp(ip.ip_address)} style={{
                              padding: '5px 12px', background: '#fef2f2', color: '#dc2626',
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

          {/* ===== EXCLUSIONS D'INVITATION (avec compte) ===== */}
          {tab === 'invitations' && (
            <div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                ⚠️ Les utilisateurs marqués "Exclu" ne recevront plus d'invitation eBrigade ni manuelle tant que leur exclusion est active.
              </div>
              <div style={{ marginBottom: 16 }}>
                <input
                  value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur…"
                  style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 6, width: 300, fontSize: 14 }}
                />
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
                  Utilisateurs ({filteredUsers.length})
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
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Statut invitation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: u.invitation_excluded ? '#fef2f2' : 'transparent'
                        }}>
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

          {/* ===== EMAILS EXCLUS (sans profil) ===== */}
          {tab === 'emails' && (
            <div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
                ℹ️ Ajoutez ici les adresses email de personnes qui n'ont pas encore de compte mais ne doivent pas recevoir d'invitation (ni via eBrigade, ni manuellement).
              </div>
              {/* Add form */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Exclure une adresse email</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Adresse email *</label>
                    <input
                      value={newExcEmail} onChange={e => setNewExcEmail(e.target.value)}
                      placeholder="ex: jean.dupont@example.com"
                      type="email"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 260 }}
                      onKeyDown={e => e.key === 'Enter' && addExcludedEmail()}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Raison (optionnel)</label>
                    <input
                      value={newExcReason} onChange={e => setNewExcReason(e.target.value)}
                      placeholder="ex: Déjà parti / Ne souhaite pas"
                      style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 260 }}
                      onKeyDown={e => e.key === 'Enter' && addExcludedEmail()}
                    />
                  </div>
                  <button onClick={addExcludedEmail} disabled={emailBusy || !newExcEmail.includes('@')} style={{
                    padding: '8px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 6,
                    fontWeight: 600, cursor: emailBusy || !newExcEmail.includes('@') ? 'not-allowed' : 'pointer',
                    opacity: !newExcEmail.includes('@') ? 0.5 : 1
                  }}>
                    {emailBusy ? '…' : '🚫 Exclure'}
                  </button>
                </div>
              </div>
              {/* List */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
                  Emails exclus ({excludedEmails.length})
                </div>
                {emailsLoading ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Chargement…</div>
                ) : excludedEmails.length === 0 ? (
                  <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>✅ Aucun email exclu</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Email</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Raison</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excludedEmails.map(row => (
                        <tr key={row.email} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 14 }}>{row.email}</td>
                          <td style={{ padding: '10px 16px', color: '#374151', fontSize: 13 }}>{row.reason || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>
                            {row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button onClick={() => removeExcludedEmail(row.email)} style={{
                              padding: '5px 12px', background: '#fff7ed', color: '#f97316',
                              border: '1px solid #fed7aa', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}>Réautoriser</button>
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
