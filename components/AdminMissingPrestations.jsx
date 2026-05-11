import { useState, useEffect, useCallback } from 'react'

// Colour coding by days overdue
function urgencyBadge(daysAgo) {
  if (daysAgo > 30) {
    return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{daysAgo}j</span>
  }
  if (daysAgo > 14) {
    return <span style={{ background: '#ffedd5', color: '#ea580c', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{daysAgo}j</span>
  }
  return <span style={{ background: '#fef9c3', color: '#ca8a04', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{daysAgo}j</span>
}

function todayMinus(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export default function AdminMissingPrestations() {
  const [startDate, setStartDate] = useState(todayMinus(60))
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sendingKey, setSendingKey] = useState(null)   // "userId:date" being sent
  const [sentKeys, setSentKeys] = useState(new Set())  // keys already sent this session
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [groupBy, setGroupBy] = useState('user') // 'user' | 'date'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setBulkResult(null)
    try {
      const resp = await fetch(`/api/admin/missing-prestations?startDate=${startDate}&endDate=${endDate}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  async function sendReminder(item) {
    const key = `${item.user_id}:${item.date}`
    setSendingKey(key)
    try {
      const resp = await fetch('/api/admin/send-missing-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: item.user_id,
          userEmail: item.user_email,
          firstName: item.first_name,
          lastName: item.last_name,
          date: item.date,
          activityName: item.activity_name,
          payType: item.pay_type,
        }),
      })
      const result = await resp.json()
      if (resp.ok) {
        setSentKeys(prev => new Set([...prev, key]))
      } else {
        alert(`Erreur : ${result.error || 'Échec de l\'envoi'}`)
      }
    } catch (e) {
      alert(`Erreur réseau : ${e.message}`)
    } finally {
      setSendingKey(null)
    }
  }

  async function sendAllReminders() {
    if (!data?.items?.length) return
    const toSend = data.items.filter(i => !sentKeys.has(`${i.user_id}:${i.date}`))
    if (toSend.length === 0) return

    if (!confirm(`Envoyer ${toSend.length} rappel(s) par email ? Cette action ne peut pas être annulée.`)) return

    setBulkSending(true)
    setBulkResult(null)
    let sent = 0, skipped = 0, failed = 0

    for (const item of toSend) {
      try {
        const resp = await fetch('/api/admin/send-missing-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: item.user_id,
            userEmail: item.user_email,
            firstName: item.first_name,
            lastName: item.last_name,
            date: item.date,
            activityName: item.activity_name,
            payType: item.pay_type,
          }),
        })
        const result = await resp.json()
        if (!resp.ok) { failed++; continue }
        if (result.sent) {
          sent++
          setSentKeys(prev => new Set([...prev, `${item.user_id}:${item.date}`]))
        } else {
          skipped++
        }
      } catch {
        failed++
      }
    }

    setBulkSending(false)
    setBulkResult({ sent, skipped, failed })
  }

  // Group items by user
  function groupByUser(items) {
    const map = {}
    for (const item of items) {
      const uid = item.user_id
      if (!map[uid]) map[uid] = { user: item, rows: [] }
      map[uid].rows.push(item)
    }
    return Object.values(map).sort((a, b) =>
      `${a.user.last_name} ${a.user.first_name}`.localeCompare(`${b.user.last_name} ${b.user.first_name}`)
    )
  }

  // Group items by date
  function groupByDate(items) {
    const map = {}
    for (const item of items) {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => ({ date, rows }))
  }

  const items = data?.items || []
  const unsent = items.filter(i => !sentKeys.has(`${i.user_id}:${i.date}`))

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#1e293b', marginTop: 0 }}>⚠️ Saisies manquantes</h2>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Activités eBrigade passées pour lesquelles aucune prestation n'a été soumise dans le système.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Début</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Fin</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Grouper par</label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}>
            <option value="user">Utilisateur</option>
            <option value="date">Date</option>
          </select>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: '9px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
          {loading ? 'Chargement…' : '🔄 Actualiser'}
        </button>
        {items.length > 0 && (
          <button onClick={sendAllReminders} disabled={bulkSending || unsent.length === 0}
            style={{ padding: '9px 20px', background: unsent.length === 0 ? '#94a3b8' : '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: unsent.length === 0 ? 'default' : 'pointer', fontWeight: 600 }}>
            {bulkSending ? 'Envoi en cours…' : `📧 Tout envoyer (${unsent.length})`}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: 16, borderRadius: 8, marginBottom: 20, color: '#b91c1c' }}>
          Erreur : {error}
        </div>
      )}

      {/* Bulk result */}
      {bulkResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: 16, borderRadius: 8, marginBottom: 20, color: '#15803d' }}>
          ✅ Envoi terminé — {bulkResult.sent} envoyé(s), {bulkResult.skipped} ignoré(s), {bulkResult.failed} échec(s)
        </div>
      )}

      {/* KPI cards */}
      {data && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{data.totalMissing}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Saisies manquantes</div>
          </div>
          <div style={{ flex: 1, minWidth: 160, background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ea580c' }}>{data.usersAffected}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Utilisateurs concernés</div>
          </div>
          <div style={{ flex: 1, minWidth: 160, background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0284c7' }}>{data.ebrigadeTotal || '–'}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Participations eBrigade</div>
          </div>
          <div style={{ flex: 1, minWidth: 160, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>
              {data.ebrigadeTotal ? `${Math.round((1 - data.totalMissing / data.ebrigadeTotal) * 100)}%` : '–'}
            </div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Taux de soumission</div>
          </div>
        </div>
      )}

      {/* Table — grouped by user */}
      {!loading && items.length === 0 && data && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 10 }}>
          ✅ Aucune saisie manquante pour cette période.
        </div>
      )}

      {!loading && items.length > 0 && groupBy === 'user' && (
        <div>
          {groupByUser(items).map(({ user, rows }) => (
            <div key={user.user_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
                    {user.last_name} {user.first_name}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 13, marginLeft: 10 }}>{user.user_email}</span>
                </div>
                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                  {rows.length} manquante{rows.length > 1 ? 's' : ''}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Activité</th>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 600 }}>Ancienneté</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => {
                    const key = `${item.user_id}:${item.date}`
                    const alreadySent = sentKeys.has(key)
                    const isSending = sendingKey === key
                    return (
                      <tr key={key} style={{ borderTop: idx > 0 ? '1px solid #f1f5f9' : undefined, background: alreadySent ? '#f0fdf4' : undefined }}>
                        <td style={{ padding: '12px 20px', fontSize: 14, color: '#1e293b', fontFamily: 'monospace' }}>{item.date}</td>
                        <td style={{ padding: '12px 20px', fontSize: 14, color: '#475569' }}>{item.activity_name || '–'}</td>
                        <td style={{ padding: '12px 20px', fontSize: 14, color: '#475569' }}>{item.pay_type || '–'}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>{urgencyBadge(item.days_ago)}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          {alreadySent ? (
                            <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✅ Envoyé</span>
                          ) : (
                            <button
                              onClick={() => sendReminder(item)}
                              disabled={isSending || bulkSending}
                              style={{
                                padding: '6px 16px', background: isSending ? '#94a3b8' : '#0066cc',
                                color: '#fff', border: 'none', borderRadius: 6, fontSize: 13,
                                cursor: isSending ? 'default' : 'pointer', fontWeight: 600,
                              }}>
                              {isSending ? '…' : '📧 Rappel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Table — grouped by date */}
      {!loading && items.length > 0 && groupBy === 'date' && (
        <div>
          {groupByDate(items).map(({ date, rows }) => (
            <div key={date} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15, fontFamily: 'monospace' }}>{date}</span>
                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                  {rows.length} manquante{rows.length > 1 ? 's' : ''}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Utilisateur</th>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Activité</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 600 }}>Ancienneté</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => {
                    const key = `${item.user_id}:${item.date}`
                    const alreadySent = sentKeys.has(key)
                    const isSending = sendingKey === key
                    return (
                      <tr key={key} style={{ borderTop: idx > 0 ? '1px solid #f1f5f9' : undefined, background: alreadySent ? '#f0fdf4' : undefined }}>
                        <td style={{ padding: '12px 20px', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                          {item.last_name} {item.first_name}
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#64748b' }}>{item.user_email}</td>
                        <td style={{ padding: '12px 20px', fontSize: 14, color: '#475569' }}>{item.activity_name || item.pay_type || '–'}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>{urgencyBadge(item.days_ago)}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          {alreadySent ? (
                            <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✅ Envoyé</span>
                          ) : (
                            <button
                              onClick={() => sendReminder(item)}
                              disabled={isSending || bulkSending}
                              style={{
                                padding: '6px 16px', background: isSending ? '#94a3b8' : '#0066cc',
                                color: '#fff', border: 'none', borderRadius: 6, fontSize: 13,
                                cursor: isSending ? 'default' : 'pointer', fontWeight: 600,
                              }}>
                              {isSending ? '…' : '📧 Rappel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 16 }}>
          Interrogation d'eBrigade et comparaison avec la base de données…
        </div>
      )}
    </div>
  )
}
