import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function GenerateInvoicesPage() {
  const router = useRouter()

  // Prestations
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('sent_to_billing')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterAnalytic, setFilterAnalytic] = useState('')
  const [analytics, setAnalytics] = useState([])

  // Export state
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingIds, setExportingIds] = useState({})
  const [recompiling, setRecompiling] = useState(false)
  const [recompilingByAnalytic, setRecompilingByAnalytic] = useState(false)
  const [recompilingAll, setRecompilingAll] = useState(false)

  // Compiled PDFs history
  const [exportFiles, setExportFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // Send email
  const [sendEmailOpen, setSendEmailOpen] = useState(false)
  const [emailTarget, setEmailTarget] = useState(null) // { url, filename }
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Settings — saved emails
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savedEmails, setSavedEmails] = useState([])
  const [settingsInput, setSettingsInput] = useState('')

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('gi_saved_emails') || '[]')
      if (Array.isArray(stored)) setSavedEmails(stored)
    } catch (e) { /* ignore */ }
  }, [])

  function persistEmails(list) {
    setSavedEmails(list)
    localStorage.setItem('gi_saved_emails', JSON.stringify(list))
  }

  function addSavedEmail() {
    const email = settingsInput.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) return alert('Adresse email invalide')
    if (savedEmails.includes(email)) return
    persistEmails([...savedEmails, email])
    setSettingsInput('')
  }

  function removeSavedEmail(email) {
    persistEmails(savedEmails.filter(e => e !== email))
  }

  // Load analytics list
  useEffect(() => {
    async function loadAnalytics() {
      try {
        const r = await fetch('/api/analytics')
        if (!r.ok) return
        const d = await r.json()
        setAnalytics(d.items || d || [])
      } catch (e) { /* ignore */ }
    }
    loadAnalytics()
  }, [])

  // Fetch prestations when filters change
  useEffect(() => {
    fetchPrestations()
  }, [filterStatus, filterDateFrom, filterDateTo])

  // Load compiled PDFs history
  useEffect(() => {
    fetchExportFiles()
  }, [])

  async function fetchPrestations() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('status', filterStatus === 'all' ? 'all' : filterStatus)
      if (filterDateFrom) params.append('date_from', filterDateFrom)
      if (filterDateTo) params.append('date_to', filterDateTo)
      const res = await fetch(`/api/comptabilite/prestations?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors de la récupération')
      const data = await res.json()
      setPrestations(Array.isArray(data) ? data : data.prestations || [])
    } catch (err) {
      setError(err.message)
      setPrestations([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchExportFiles() {
    setLoadingFiles(true)
    try {
      const res = await fetch('/api/admin/list-exports')
      const data = await res.json()
      setExportFiles(data.files || [])
    } catch (e) {
      setExportFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  // Computed
  const safePrestations = (prestations || []).filter(Boolean)

  const analyticOptions = Array.from(
    safePrestations.reduce((map, p) => {
      const id = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
      const name = p.analytic_name || 'Non assigné'
      if (!map.has(id)) map.set(id, name)
      return map
    }, new Map())
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredPrestations = safePrestations.filter(p => {
    const query = (searchQuery || '').toLowerCase()
    const matchSearch = !query || [p.user_name, p.first_name, p.last_name, p.email, p.activity_type, p.analytic_name]
      .some(v => (v || '').toString().toLowerCase().includes(query))
    const dateVal = (p.date || p.created_at || '').slice(0, 10)
    const matchFrom = !filterDateFrom || dateVal >= filterDateFrom
    const matchTo = !filterDateTo || dateVal <= filterDateTo
    const matchAnalytic = !filterAnalytic || (
      filterAnalytic === 'unassigned' ? p.analytic_id == null : String(p.analytic_id) === filterAnalytic
    )
    return matchSearch && matchFrom && matchTo && matchAnalytic
  })

  const pendingCount = filteredPrestations.filter(p => p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation').length
  const pendingAmount = filteredPrestations.reduce((s, p) => s + (parseFloat(p.remuneration) || 0), 0)

  // Export all pending prestations
  async function exportAll() {
    const pending = filteredPrestations.filter(p => p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation')
    if (pending.length === 0) return alert('Aucune prestation à facturer dans la sélection')
    const userCount = new Set(pending.map(p => p.user_id)).size
    if (!confirm(`📤 Générer les factures pour ${pending.length} prestation(s) — ${userCount} prestataire(s) ?\n\nToutes seront marquées « Facturé ».`)) return

    setExportingAll(true)
    try {
      const res = await fetch('/api/comptabilite/export-all-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_ids: pending.map(p => p.id) }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Erreur export')
      }
      const compilationUrl = res.headers.get('X-Compilation-Url')
      const blob = await res.blob()
      downloadBlob(blob, `Compilation_Factures_${new Date().toISOString().split('T')[0]}.pdf`)
      await fetchExportFiles()
      await fetchPrestations()
      if (compilationUrl) {
        const filename = compilationUrl.split('/').pop()
        openSendEmail({ url: compilationUrl, filename })
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setExportingAll(false)
    }
  }

  // Export one analytic group
  async function exportForAnalytic(analyticId, analyticName, items) {
    if (items.length === 0) return
    if (!confirm(`📄 Exporter ${items.length} prestation(s) pour « ${analyticName} » ?\n\nElles seront marquées « Facturé ».`)) return
    setExportingIds(p => ({ ...p, [analyticId]: true }))
    try {
      const res = await fetch('/api/comptabilite/export-all-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_ids: items.map(p => p.id), analyticName }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Erreur export')
      }
      const compilationUrl = res.headers.get('X-Compilation-Url')
      const blob = await res.blob()
      downloadBlob(blob, `Factures_${analyticName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
      await fetchExportFiles()
      await fetchPrestations()
      if (compilationUrl) {
        const filename = compilationUrl.split('/').pop()
        openSendEmail({ url: compilationUrl, filename })
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setExportingIds(p => { const n = { ...p }; delete n[analyticId]; return n })
    }
  }

  // Recompile by analytic for a specific compilation file
  async function recompileByAnalyticForFile(f) {
    const match = f.filename && f.filename.match(/(\d{13})/)
    const compilationTs = match ? parseInt(match[1]) : null
    if (!compilationTs) return alert('Impossible d\'identifier le timestamp de la compilation')
    setRecompilingAll(true)
    try {
      const pdf_ts_min = compilationTs - 2 * 60 * 60 * 1000
      const pdf_ts_max = compilationTs
      const params = new URLSearchParams({ status: 'invoiced', pdf_ts_min: String(pdf_ts_min), pdf_ts_max: String(pdf_ts_max) })
      const res = await fetch(`/api/comptabilite/prestations?${params}`)
      if (!res.ok) throw new Error('Erreur chargement prestations')
      const data = await res.json()
      const invoiced = (Array.isArray(data) ? data : data.prestations || []).filter(p => p && p.status === 'Facturé')
      if (invoiced.length === 0) { alert(`Aucune prestation trouvée pour cette compilation`); return }
      const analyticMap = new Map()
      for (const p of invoiced) {
        const key = p.analytic_id != null ? String(p.analytic_id) : 'null'
        if (!analyticMap.has(key)) analyticMap.set(key, { name: p.analytic_name || 'Non assigné', ids: [] })
        analyticMap.get(key).ids.push(p.id)
      }
      const analytics = Array.from(analyticMap.values())
      const date = f.created_at ? new Date(f.created_at).toISOString().split('T')[0] : ''
      if (!confirm(`📂 Décompiler ${invoiced.length} facture(s) en ${analytics.length} PDF(s) par analytique ?\nAucun statut ne sera modifié.`)) return
      for (const analytic of analytics) {
        const r = await fetch('/api/comptabilite/recompile-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prestation_ids: analytic.ids, regenerate: true }),
        })
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Erreur pour ${analytic.name}`) }
        const blob = await r.blob()
        const safeName = analytic.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        downloadBlob(blob, `Recompilation_${safeName}_${date}.pdf`)
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setRecompilingAll(false)
    }
  }

  // Recompile by analytic from server — fetches all Facturé regardless of current filter
  async function recompileByAnalyticAll() {
    setRecompilingAll(true)
    try {
      const res = await fetch('/api/comptabilite/prestations?status=invoiced')
      if (!res.ok) throw new Error('Erreur chargement prestations')
      const data = await res.json()
      const invoiced = (Array.isArray(data) ? data : data.prestations || []).filter(p => p && p.status === 'Facturé')
      if (invoiced.length === 0) { alert('Aucune prestation facturée trouvée'); return }
      const analyticMap = new Map()
      for (const p of invoiced) {
        const key = p.analytic_id != null ? String(p.analytic_id) : 'null'
        if (!analyticMap.has(key)) analyticMap.set(key, { name: p.analytic_name || 'Non assigné', ids: [] })
        analyticMap.get(key).ids.push(p.id)
      }
      const analytics = Array.from(analyticMap.values())
      if (!confirm(`📂 Décompiler toutes les factures en ${analytics.length} PDF(s) — un par analytique ?\nAucun statut ne sera modifié.`)) return
      for (const analytic of analytics) {
        const r = await fetch('/api/comptabilite/recompile-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prestation_ids: analytic.ids, regenerate: true }),
        })
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Erreur pour ${analytic.name}`) }
        const blob = await r.blob()
        const safeName = analytic.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        downloadBlob(blob, `Recompilation_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`)
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setRecompilingAll(false)
    }
  }

  // Recompile by analytic — one PDF per analytic, no status change
  async function recompileByAnalytic() {
    const invoiced = filteredPrestations.filter(p => p.status === 'Facturé')
    if (invoiced.length === 0) return alert('Aucune prestation facturée dans la sélection')
    const analyticMap = new Map()
    for (const p of invoiced) {
      const key = p.analytic_id != null ? String(p.analytic_id) : 'null'
      if (!analyticMap.has(key)) analyticMap.set(key, { analytic_id: p.analytic_id ?? null, name: p.analytic_name || 'Non assigné', ids: [] })
      analyticMap.get(key).ids.push(p.id)
    }
    const analytics = Array.from(analyticMap.values())
    if (!confirm(`📂 Décompiler en ${analytics.length} PDF(s) — un par analytique ?\nAucun statut ne sera modifié.`)) return
    setRecompilingByAnalytic(true)
    try {
      for (const analytic of analytics) {
        const res = await fetch('/api/comptabilite/recompile-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prestation_ids: analytic.ids, regenerate: true }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Erreur pour ${analytic.name}`) }
        const blob = await res.blob()
        const safeName = analytic.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        downloadBlob(blob, `Recompilation_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`)
        await new Promise(r => setTimeout(r, 600))
      }
      await fetchExportFiles()
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setRecompilingByAnalytic(false)
    }
  }

  // Recompile existing invoiced PDFs
  async function recompilePdf() {
    const invoiced = filteredPrestations.filter(p => p.status === 'Facturé')
    if (invoiced.length === 0) return alert('Aucune prestation facturée dans la sélection')
    if (!confirm(`📄 Recompiler un PDF avec les ${invoiced.length} facture(s) existantes ? Aucun statut ne changera.`)) return
    setRecompiling(true)
    try {
      const body = {
        prestation_ids: invoiced.map(p => p.id),
        ...(filterAnalytic && filterAnalytic !== 'unassigned' ? { analytic_id: Number(filterAnalytic) } : {}),
      }
      const res = await fetch('/api/comptabilite/recompile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Erreur recompilation')
      }
      const blob = await res.blob()
      downloadBlob(blob, `Recompilation_${new Date().toISOString().split('T')[0]}.pdf`)
      await fetchExportFiles()
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setRecompiling(false)
    }
  }

  function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  function openSendEmail({ url, filename }) {
    setEmailTarget({ url, filename })
    setEmailTo(savedEmails.join('; '))
    setEmailSubject(`Compilation de factures — ${new Date().toLocaleDateString('fr-FR')}`)
    setSendEmailOpen(true)
  }

  async function sendCompilationEmail() {
    if (!emailTarget || !emailTo.trim()) return
    const emailList = emailTo.split(';').map(e => e.trim()).filter(Boolean)
    if (emailList.length === 0) return alert('Saisissez au moins une adresse email')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const e of emailList) {
      if (!emailRegex.test(e)) return alert(`Adresse invalide : ${e}`)
    }
    setSendingEmail(true)
    try {
      const res = await fetch('/api/admin/send-pdf-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_path: emailTarget.filename,
          email_to: emailTo.trim(),
          subject: emailSubject,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      alert(`✅ ${data.message}`)
      setSendEmailOpen(false)
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setSendingEmail(false)
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' o'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko'
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
  }

  // Group filtered prestations by analytic
  const groups = Object.entries(
    filteredPrestations.reduce((acc, p) => {
      const id = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
      const name = p.analytic_name || 'Non assigné'
      const key = `${id}|${name}`
      if (!acc[key]) acc[key] = { analyticId: id, analyticName: name, items: [] }
      acc[key].items.push(p)
      return acc
    }, {})
  )

  return (
    <>
      <div className="admin-layout">
        <AdminHeader />
        <div className="admin-container">
          <AdminSidebar />
          <main className="admin-main">

            {/* Header */}
            <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <button
                  onClick={() => router.push('/admin/facturation')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, marginBottom: 8, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ← Retour à la facturation
                </button>
                <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 6 }}>
                  📅 Génération des factures par période
                </h1>
                <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                  Sélectionnez une période, prévisualisez et générez les factures
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                style={{ padding: '9px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                ⚙️ Paramètres
              </button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <StatCard label="En attente" value={pendingCount} icon="📤" color="#f59e0b" sub={`${pendingAmount.toFixed(2)} €`} />
              <StatCard label="Total dans la sélection" value={filteredPrestations.length} icon="🧾" color="#3b82f6" sub={`${filteredPrestations.reduce((s, p) => s + (parseFloat(p.remuneration) || 0), 0).toFixed(2)} €`} />
              <StatCard label="Compilations générées" value={exportFiles.length} icon="📂" color="#8b5cf6" sub="PDF disponibles" />
            </div>

            {/* Filters */}
            <div style={{ background: 'white', borderRadius: 8, padding: 20, marginBottom: 20, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={labelStyle}>🔍 Rechercher</label>
                  <input type="text" placeholder="Nom, email, activité..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>📋 Statut</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
                    <option value="sent_to_billing">À facturer</option>
                    <option value="invoiced">Facturées</option>
                    <option value="all">Toutes</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>📅 Du</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Au</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    {(filterDateFrom || filterDateTo) && (
                      <button onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f3f4f6', cursor: 'pointer', fontSize: 13, color: '#374151' }}>✕</button>
                    )}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>📊 Analytique</label>
                  <select value={filterAnalytic} onChange={e => setFilterAnalytic(e.target.value)} style={inputStyle}>
                    <option value="">Toutes</option>
                    {analyticOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {filterStatus === 'invoiced' && filteredPrestations.filter(p => p.status === 'Facturé').length > 0 && (
                <>
                  <button onClick={recompileByAnalytic} disabled={recompilingByAnalytic || recompiling} style={btnStyle('#7c3aed', recompilingByAnalytic || recompiling)}>
                    {recompilingByAnalytic ? '⏳ Décompilation...' : '📂 Décompiler par analytique'}
                  </button>
                  <button onClick={recompilePdf} disabled={recompiling || recompilingByAnalytic} style={btnStyle('#0891b2', recompiling || recompilingByAnalytic)}>
                    {recompiling ? '⏳ Compilation...' : `📄 Recompiler PDF (${filteredPrestations.filter(p => p.status === 'Facturé').length})`}
                  </button>
                </>
              )}
              {pendingCount > 0 && (
                <button onClick={exportAll} disabled={exportingAll} style={btnStyle('#059669', exportingAll)}>
                  {exportingAll ? '⏳ Génération en cours...' : `📤 Tout générer (${pendingCount} prestations)`}
                </button>
              )}
            </div>

            {/* Prestations grouped by analytic */}
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8 }}>⏳ Chargement...</div>
            ) : error ? (
              <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 6 }}><strong>❌</strong> {error}</div>
            ) : filteredPrestations.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div>Aucune prestation trouvée avec ces filtres</div>
              </div>
            ) : (
              groups.map(([groupKey, { analyticId, analyticName, items }]) => {
                const groupTotal = items.reduce((s, p) => s + (parseFloat(p.remuneration) || 0), 0)
                const isPending = items.some(p => p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation')
                return (
                  <div key={groupKey} style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 3 }}>📊 {analyticName}</h2>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{items.length} prestation{items.length > 1 ? 's' : ''} · {groupTotal.toFixed(2)} €</p>
                      </div>
                      {isPending && (
                        <button
                          onClick={() => exportForAnalytic(analyticId, analyticName, items.filter(p => p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation'))}
                          disabled={!!exportingIds[analyticId]}
                          style={btnStyle('#10b981', !!exportingIds[analyticId])}
                        >
                          {exportingIds[analyticId] ? '⏳ Export...' : `📄 Exporter (${items.filter(p => p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation').length})`}
                        </button>
                      )}
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                              {['Collaborateur', 'Activité', 'Montant', 'Date', 'Statut'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((p, i) => (
                              <tr key={p.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                                  {p.user_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'}
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: 13, color: '#374151' }}>{p.activity_type || '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#059669' }}>{(parseFloat(p.remuneration) || 0).toFixed(2)} €</td>
                                <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                                  {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: 13 }}>
                                  <StatusBadge status={p.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* ── Compilations générées ─────────────────────────────── */}
            <div style={{ marginTop: 48 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4 }}>📂 Compilations générées</h2>
                  <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Tous les PDFs compilés disponibles sur le serveur</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={fetchExportFiles} style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    🔄 Actualiser
                  </button>
                </div>
              </div>

              {loadingFiles ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb' }}>⏳ Chargement...</div>
              ) : exportFiles.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                  <div style={{ fontSize: 13 }}>Aucune compilation générée pour l'instant</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {exportFiles.map(f => (
                    <div key={f.filename} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22 }}>📄</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{f.filename}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {new Date(f.created_at).toLocaleString('fr-FR')} · {formatBytes(f.size)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={f.url} target="_blank" rel="noreferrer"
                          style={{ padding: '7px 14px', background: '#3b82f6', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                          👁️ Voir
                        </a>
                        <a href={f.url} download
                          style={{ padding: '7px 14px', background: '#6b7280', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                          ⬇️ Télécharger
                        </a>
                        <button onClick={() => openSendEmail(f)}
                          style={{ padding: '7px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          ✉️ Envoyer
                        </button>
                        <button onClick={() => recompileByAnalyticForFile(f)} disabled={recompilingAll}
                          style={{ padding: '7px 14px', background: recompilingAll ? '#ede9fe' : '#7c3aed', color: 'white', border: 'none', borderRadius: 6, cursor: recompilingAll ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: recompilingAll ? 0.7 : 1 }}>
                          {recompilingAll ? '⏳...' : '📂 Décompiler'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── Settings modal ───────────────────────────────────────────── */}
      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1700 }}
          onClick={() => setSettingsOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 480, padding: '28px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>⚙️ Paramètres — Adresses mail</h2>
              <button onClick={() => setSettingsOpen(false)}
                style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 15, color: '#6b7280' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 18 }}>
              Ces adresses seront pré-chargées automatiquement lors de l'envoi d'une compilation.
            </p>

            {/* Add new email */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="email"
                placeholder="nouvelle@adresse.com"
                value={settingsInput}
                onChange={e => setSettingsInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSavedEmail()}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
              <button onClick={addSavedEmail}
                style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                + Ajouter
              </button>
            </div>

            {/* Saved emails list */}
            {savedEmails.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Aucune adresse enregistrée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedEmails.map(em => (
                  <div key={em} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: '#1f2937' }}>✉️ {em}</span>
                    <button onClick={() => removeSavedEmail(em)}
                      style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setSettingsOpen(false)}
                style={{ padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send email modal ──────────────────────────────────────────── */}
      {sendEmailOpen && emailTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1700 }}
          onClick={() => !sendingEmail && setSendEmailOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 480, padding: '28px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>✉️ Envoyer par mail</h2>
              <button onClick={() => setSendEmailOpen(false)} disabled={sendingEmail}
                style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 15, color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#065f46' }}>
              📎 <strong>{emailTarget.filename}</strong>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>DESTINATAIRE(S) <span style={{ color: '#dc2626' }}>*</span></label>
              {savedEmails.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {savedEmails.map(em => {
                    const active = emailTo.split(';').map(s => s.trim()).includes(em)
                    return (
                      <button key={em} onClick={() => {
                        const current = emailTo.split(';').map(s => s.trim()).filter(Boolean)
                        if (active) {
                          setEmailTo(current.filter(e => e !== em).join('; '))
                        } else {
                          setEmailTo([...current, em].join('; '))
                        }
                      }} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`, background: active ? '#dbeafe' : '#f9fafb', color: active ? '#1e40af' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {active ? '✓ ' : '+ '}{em}
                      </button>
                    )
                  })}
                </div>
              )}
              <input
                type="text"
                placeholder="email@exemple.com ; autre@exemple.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '11px 14px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Séparez plusieurs adresses par des points-virgules</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>OBJET</label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setSendEmailOpen(false)} disabled={sendingEmail}
                style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                Annuler
              </button>
              <button onClick={sendCompilationEmail} disabled={sendingEmail || !emailTo.trim()}
                style={btnStyle('#2563eb', sendingEmail || !emailTo.trim())}>
                {sendingEmail ? '⏳ Envoi...' : '✉️ Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: 'white', boxSizing: 'border-box' }
const btnStyle = (color, disabled) => ({
  padding: '10px 20px',
  background: disabled ? '#9ca3af' : color,
  color: 'white',
  border: 'none',
  borderRadius: 7,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: 'nowrap',
})

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: 'white', border: `2px solid ${color}20`, borderRadius: 8, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    'sent_to_billing': { bg: '#dbeafe', color: '#1e40af', label: '📤 À facturer' },
    'Envoyé à la facturation': { bg: '#dbeafe', color: '#1e40af', label: '📤 À facturer' },
    'Facturé': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'invoiced': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'Payé': { bg: '#d1fae5', color: '#065f46', label: '💰 Payé' },
    'paid': { bg: '#d1fae5', color: '#065f46', label: '💰 Payé' },
  }
  const cfg = map[status] || { bg: '#f3f4f6', color: '#374151', label: status || '—' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}
