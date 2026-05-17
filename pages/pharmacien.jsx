import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function toLocalISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function PharmacienPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [prestations, setPrestations] = useState([])
  const [userAnalytic, setUserAnalytic] = useState(null) // { id, name } from user profile
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [modal, setModal] = useState(null) // { date: 'YYYY-MM-DD', existing: null|prestation }
  const [form, setForm] = useState({ hours: '', comment: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // RIB state
  const [ribStatus, setRibStatus] = useState(null) // null | 'none' | 'pending' | 'approved' | 'rejected'
  const [ribUploading, setRibUploading] = useState(false)
  const [ribError, setRibError] = useState('')
  const [ribSuccess, setRibSuccess] = useState('')
  const ribFileRef = React.useRef(null)

  const loadRib = (userEmail) => {
    fetch('/api/documents?email=' + encodeURIComponent(userEmail))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const docs = (d && d.documents) || []
        const rib = docs[0] || null
        setRibStatus(rib ? (rib.validation_status || 'pending') : 'none')
      })
      .catch(() => setRibStatus('none'))
  }

  const handleRibUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setRibError('Veuillez sélectionner un fichier PDF'); return }
    if (file.size > 5 * 1024 * 1024) { setRibError('Le fichier ne doit pas dépasser 5 MB'); return }
    setRibUploading(true); setRibError(''); setRibSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('email', email)
      fd.append('documentType', 'RIB')
      const r = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Erreur ${r.status}`) }
      setRibStatus('pending')
      setRibSuccess('RIB soumis — en attente de validation par l\'administrateur')
      if (ribFileRef.current) ribFileRef.current.value = ''
      setTimeout(() => setRibSuccess(''), 6000)
    } catch (err) {
      setRibError(err.message || 'Erreur lors de l\'upload')
    } finally {
      setRibUploading(false)
    }
  }

  useEffect(() => {
    const e = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (!e) { router.push('/login'); return }
    if (role && !role.toLowerCase().includes('pharmacien') && role !== 'admin') { router.push('/'); return }
    setEmail(e)
    Promise.all([
      fetch(`/api/prestations?email=${encodeURIComponent(e)}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/users/profile?email=${encodeURIComponent(e)}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([prestData, profileData]) => {
      const all = (prestData.prestations || []).filter(p => (p.pay_type || '').toLowerCase().includes('pharmacien'))
      setPrestations(all)
      if (profileData && profileData.pharmacien_analytic_id) {
        setUserAnalytic({ id: profileData.pharmacien_analytic_id, name: profileData.analytic_name })
      }
    }).finally(() => setLoading(false))
    loadRib(e)
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Build calendar grid (Mon-first)
  const firstDow = new Date(year, month, 1).getDay()
  const blanks = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(blanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Index prestations by date key
  const byDate = {}
  for (const p of prestations) {
    const key = String(p.date || '').slice(0, 10)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(p)
  }

  // Month stats
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthEntries = prestations.filter(p => String(p.date || '').startsWith(monthKey))
  const totalHours = monthEntries.reduce((s, p) => s + Number(p.hours_actual || 0), 0)
  const filledDays = new Set(monthEntries.map(p => String(p.date || '').slice(0, 10))).size

  function openDay(day) {
    const key = toLocalISODate(day)
    const entries = byDate[key] || []
    setModal({ date: key, entries })
    setForm({ hours: '', comment: '' })
    setSaveError('')
  }

  async function handleSave() {
    if (!form.hours || Number(form.hours) <= 0) { setSaveError("Nombre d'heures requis"); return }
    if (!userAnalytic) { setSaveError('Aucun analytique configuré — contactez un administrateur'); return }
    setSaving(true); setSaveError('')
    try {
      const payload = {
        user_email: email, email,
        date: modal.date,
        pay_type: 'Pharmacien',
        hours_actual: parseFloat(form.hours),
        comments: form.comment || null,
        analytic_id: userAnalytic.id,
        analytic_name: userAnalytic.name,
        status: 'Validé',
        is_admin_override: true,
      }
      const res = await fetch('/api/admin/prestations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      // Refresh
      const r = await fetch(`/api/prestations?email=${encodeURIComponent(email)}`)
      const d = await r.json()
      const all = (d.prestations || []).filter(p => (p.pay_type || '').toLowerCase().includes('pharmacien'))
      setPrestations(all)
      setModal(null)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canGoNext = new Date(year, month + 1, 1) <= today

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>💊 Mes heures</h1>
          <div className="small-muted">Cliquez sur un jour pour renseigner vos heures</div>
        </div>

        {loading ? (
          <div className="small-muted">Chargement…</div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Month summary strip */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '14px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Heures ce mois</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#5b21b6' }}>{totalHours.toLocaleString('fr-FR')}h</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '14px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Jours renseignés</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#5b21b6' }}>{filledDays}</div>
              </div>
            </div>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >‹</button>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
                {MONTHS_FR[month]} {year}
              </h2>
              <button
                onClick={() => canGoNext && setViewDate(new Date(year, month + 1, 1))}
                style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #e5e7eb', background: canGoNext ? '#fff' : '#f9fafb', cursor: canGoNext ? 'pointer' : 'not-allowed', fontSize: 18, fontWeight: 700, color: canGoNext ? '#374151' : '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >›</button>
            </div>

            {/* Calendar */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #f3f4f6' }}>
                {DAYS_FR.map((d, i) => (
                  <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: i >= 5 ? '#a78bfa' : '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((day, i) => {
                  if (!day) {
                    return <div key={`b-${i}`} style={{ minHeight: 80, borderRight: (i + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none', borderBottom: i < cells.length - 7 ? '1px solid #f3f4f6' : 'none', background: '#fafafa' }} />
                  }

                  const key = toLocalISODate(day)
                  const todayKey = toLocalISODate(today)
                  const isFuture = day > today
                  const isToday = key === todayKey
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const entries = byDate[key] || []
                  const isFilled = entries.length > 0
                  const totalH = entries.reduce((s, e) => s + Number(e.hours_actual || 0), 0)

                  return (
                    <div
                      key={key}
                      onClick={() => !isFuture && openDay(day)}
                      style={{
                        minHeight: 80,
                        padding: '8px 10px',
                        borderRight: (i + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none',
                        borderBottom: i < cells.length - 7 ? '1px solid #f3f4f6' : 'none',
                        background: isFilled ? '#f5f3ff' : isToday ? '#fefce8' : isFuture ? '#fafafa' : isWeekend ? '#fdfdfe' : '#fff',
                        cursor: isFuture ? 'default' : 'pointer',
                        transition: 'background 0.12s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isFuture && !isFilled) e.currentTarget.style.background = '#f9f8ff' }}
                      onMouseLeave={e => {
                        if (!isFuture && !isFilled) {
                          e.currentTarget.style.background = isToday ? '#fefce8' : isWeekend ? '#fdfdfe' : '#fff'
                        }
                      }}
                    >
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%',
                        background: isToday ? '#7e22ce' : 'transparent',
                        color: isToday ? '#fff' : isFuture ? '#d1d5db' : '#374151',
                        fontSize: 13, fontWeight: isToday ? 700 : 500,
                        marginBottom: 4,
                      }}>
                        {day.getDate()}
                      </div>

                      {isFilled && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#7e22ce', lineHeight: 1.2 }}>{totalH}h</div>
                          {entries[0]?.analytic_name && (
                            <div style={{ fontSize: 10, color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{entries[0].analytic_name}</div>
                          )}
                          {entries.length > 1 && (
                            <div style={{ fontSize: 10, color: '#c4b5fd', marginTop: 1 }}>+{entries.length - 1} entrée{entries.length > 2 ? 's' : ''}</div>
                          )}
                        </div>
                      )}
                      {!isFilled && !isFuture && (
                        <div style={{ fontSize: 10, color: '#e5e7eb', marginTop: 2 }}>+ saisir</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12, color: '#9ca3af', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#f5f3ff', border: '1px solid #c4b5fd', display: 'inline-block' }} />
                Jour renseigné
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#7e22ce', display: 'inline-block' }} />
                Aujourd'hui
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fefce8', border: '1px solid #fde68a', display: 'inline-block' }} />
                Aujourd'hui (vide)
              </span>
            </div>
          </div>
        )}

        {/* RIB Section */}
        {!loading && (
          <div style={{ maxWidth: 720, margin: '24px auto 0' }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>📄 Mon RIB</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                Votre RIB est nécessaire pour le traitement des paiements.
              </p>

              {ribStatus === 'approved' && (
                <div style={{ padding: '12px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#065f46', fontWeight: 600 }}>
                  <span style={{ fontSize: 20 }}>✅</span> RIB validé — aucune action requise
                </div>
              )}
              {ribStatus === 'pending' && (
                <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#92400e', fontWeight: 600 }}>
                  <span style={{ fontSize: 20 }}>⏳</span> RIB soumis — en attente de validation
                </div>
              )}
              {ribStatus === 'rejected' && (
                <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#991b1b', fontWeight: 600 }}>
                  <span style={{ fontSize: 20 }}>❌</span> RIB rejeté — veuillez en soumettre un nouveau
                </div>
              )}
              {ribStatus === 'none' && (
                <div style={{ padding: '12px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#374151' }}>
                  <span style={{ fontSize: 20 }}>📂</span> Aucun RIB soumis
                </div>
              )}

              {ribStatus !== 'approved' && ribStatus !== null && ribStatus !== 'pending' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {ribStatus === 'rejected' ? 'Soumettre un nouveau RIB (PDF)' : 'Soumettre votre RIB (PDF)'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                      background: ribUploading ? '#f3f4f6' : '#7e22ce', color: ribUploading ? '#9ca3af' : '#fff',
                      borderRadius: 10, cursor: ribUploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
                      border: 'none', transition: 'background 0.15s'
                    }}>
                      <input ref={ribFileRef} type="file" accept="application/pdf,.pdf" onChange={handleRibUpload} disabled={ribUploading} style={{ display: 'none' }} />
                      {ribUploading ? '⏳ Upload en cours…' : '📤 Choisir un fichier PDF'}
                    </label>
                  </div>
                </div>
              )}

              {ribStatus === 'pending' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remplacer le RIB</div>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                    background: ribUploading ? '#f3f4f6' : '#f3f4f6', color: ribUploading ? '#9ca3af' : '#374151',
                    borderRadius: 10, cursor: ribUploading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
                    border: '1px solid #d1d5db', transition: 'background 0.15s'
                  }}>
                    <input ref={ribFileRef} type="file" accept="application/pdf,.pdf" onChange={handleRibUpload} disabled={ribUploading} style={{ display: 'none' }} />
                    {ribUploading ? '⏳ Upload en cours…' : '🔄 Remplacer le RIB'}
                  </label>
                </div>
              )}

              {ribError && <div style={{ marginTop: 10, padding: '8px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{ribError}</div>}
              {ribSuccess && <div style={{ marginTop: 10, padding: '8px 14px', background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{ribSuccess}</div>}
            </div>
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget && !saving) setModal(null) }}
          >
            <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 400, maxWidth: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1 }}>Saisie des heures</div>
                  <h3 style={{ margin: '4px 0 0', color: '#4c1d95', fontSize: 18, fontWeight: 800 }}>
                    {new Date(modal.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                </div>
                <button onClick={() => !saving && setModal(null)} style={{ border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: 16, color: '#6b7280', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
              </div>

              {/* Existing entries for this day */}
              {modal.entries && modal.entries.length > 0 && (
                <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Déjà saisi ce jour</div>
                  {modal.entries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#5b21b6', padding: '3px 0' }}>
                      <span>{e.analytic_name || '—'}</span>
                      <span style={{ fontWeight: 700 }}>{e.hours_actual}h</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gap: 14 }}>
                <label>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Heures travaillées *</div>
                  <input
                    type="number" step="0.25" min="0.25" max="24"
                    value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                    placeholder="ex: 8" autoFocus
                    style={{ width: '100%', padding: '11px 14px', border: '2px solid #e9d5ff', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    onFocus={e => { e.target.style.borderColor = '#7e22ce' }}
                    onBlur={e => { e.target.style.borderColor = '#e9d5ff' }}
                  />
                </label>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Analytique</div>
                  <div style={{ padding: '11px 14px', border: '2px solid #e9d5ff', borderRadius: 10, fontSize: 15, background: '#f5f3ff', color: '#5b21b6', fontWeight: 600 }}>
                    {userAnalytic ? userAnalytic.name : <span style={{ color: '#ef4444', fontWeight: 500 }}>Non configuré — contactez un admin</span>}
                  </div>
                </div>

                <label>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Commentaire</div>
                  <input
                    type="text" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                    placeholder="Optionnel…"
                    style={{ width: '100%', padding: '11px 14px', border: '2px solid #e9d5ff', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
                    onFocus={e => { e.target.style.borderColor = '#7e22ce' }}
                    onBlur={e => { e.target.style.borderColor = '#e9d5ff' }}
                  />
                </label>

                {saveError && (
                  <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{saveError}</div>
                )}

                <button
                  onClick={handleSave} disabled={saving}
                  style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: saving ? '#c4b5fd' : '#7e22ce', color: '#fff', fontWeight: 800, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: 0.3, marginTop: 4, transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!saving) e.target.style.background = '#6b21a8' }}
                  onMouseLeave={e => { if (!saving) e.target.style.background = '#7e22ce' }}
                >
                  {saving ? '⏳ Enregistrement…' : '✅ Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
