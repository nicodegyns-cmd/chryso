import React, { useEffect, useState, useMemo } from 'react'

function parseTimeToMinutes(value) {
  if (!value) return null
  const s = String(value).trim().toLowerCase()
  const m = s.match(/(\d{1,2})(?:[:h](\d{2}))?/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] || 0)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return (h * 60) + min
}

function inferDurationHours(prestation) {
  const explicit = Number(prestation?.ebrigade_duration_hours || 0)
  if (explicit > 0) return explicit

  const start = parseTimeToMinutes(prestation?.ebrigade_start_time)
  const end = parseTimeToMinutes(prestation?.ebrigade_end_time)
  if (start != null && end != null) {
    const delta = end >= start ? (end - start) : ((end + 24 * 60) - start)
    if (delta > 0) return delta / 60
  }

  const text = String(prestation?.ebrigade_activity_name || prestation?.analytic_name || '')
  const tm = text.match(/(\d{1,2})(?:[:h](\d{2}))?\s*-\s*(\d{1,2})(?:[:h](\d{2}))?/i)
  if (tm) {
    const sh = Number(tm[1]); const sm = Number(tm[2] || 0)
    const eh = Number(tm[3]); const em = Number(tm[4] || 0)
    const s = (sh * 60) + sm
    const e = (eh * 60) + em
    const delta = e >= s ? (e - s) : ((e + 24 * 60) - s)
    if (delta > 0) return delta / 60
  }

  return 0
}

function normalizeBreakdown(prestation) {
  const duration = inferDurationHours(prestation)
  const garde = Number(prestation?.garde_hours || 0)
  const sortie = Number(prestation?.sortie_hours || 0)
  const overtime = Number(prestation?.overtime_hours || 0)
  const actual = Number(prestation?.hours_actual || 0)

  if (duration > 0 && garde === 0 && sortie > duration) {
    return {
      garde_hours: 0,
      sortie_hours: duration,
      overtime_hours: Math.round((sortie - duration) * 100) / 100,
      hours_actual: actual,
    }
  }

  if (duration > 0 && garde === 0 && sortie === 0 && actual > duration) {
    return {
      garde_hours: 0,
      sortie_hours: 0,
      overtime_hours: Math.round((actual - duration) * 100) / 100,
      hours_actual: duration,
    }
  }

  return {
    garde_hours: garde,
    sortie_hours: sortie,
    overtime_hours: overtime,
    hours_actual: actual,
  }
}

export default function AdminPrestationsSummary({ limit = 8, filterAnalyticIds = null }){
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingIds, setSavingIds] = useState({})
  const [statusFilter, setStatusFilter] = useState("En attente d'approbation")
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [refusingId, setRefusingId] = useState(null)
  const [refusalReason, setRefusalReason] = useState('')
  const [estimatedAmounts, setEstimatedAmounts] = useState({})
  const [loadedIds, setLoadedIds] = useState(new Set())
  const [activityRates, setActivityRates] = useState({})
  const [activityNames, setActivityNames] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const statuses = ["", "A saisir", "En attente d'approbation", "En attente d'envoie", "Envoyé à la facturation", "Annulé"]
  const [viewing, setViewing] = useState(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkValidating, setBulkValidating] = useState(false)

  // Load activity rates when viewing a prestation
  useEffect(() => {
    if (viewing && !activityRates[viewing.id]) {
      loadActivityRates(viewing)
    }
  }, [viewing, activityRates])

  useEffect(()=>{ fetchItems() }, [])

  async function loadActivityRates(p) {
    try {
      const normalized = normalizeBreakdown(p)
      const r = await fetch('/api/prestations/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours_actual: p.hours_actual || 0,
          garde_hours: normalized.garde_hours,
          sortie_hours: normalized.sortie_hours,
          overtime_hours: normalized.overtime_hours,
          ebrigade_duration_hours: p.ebrigade_duration_hours || null,
          ebrigade_start_time: p.ebrigade_start_time || null,
          ebrigade_end_time: p.ebrigade_end_time || null,
          pay_type: p.pay_type,
          analytic_id: p.analytic_id,
          analytic_code: p.analytic_code || null,
          analytic_name: p.ebrigade_activity_name || p.analytic_name || null,
          user_email: p.user_email,
          expense_amount: p.expense_amount || 0
        })
      })
      if (r.ok) {
        const d = await r.json()
        setActivityRates(s => ({...s, [p.id]: d.rates}))
        setActivityNames(s => ({...s, [p.id]: d.activity_name}))
      }
    } catch (e) {
      console.error('load activity rates failed for', p.id, e)
    }
  }

  async function loadEstimatedAmounts(prestations) {
    setEstimatedAmounts(prev => {
      const newEstimates = { ...prev }
      prestations.forEach(async p => {
        if (!loadedIds.has(p.id)) {
          try {
            const normalized = normalizeBreakdown(p)
            const r = await fetch('/api/prestations/estimate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hours_actual: p.hours_actual || 0,
                garde_hours: normalized.garde_hours,
                sortie_hours: normalized.sortie_hours,
                overtime_hours: normalized.overtime_hours,
                ebrigade_duration_hours: p.ebrigade_duration_hours || null,
                ebrigade_start_time: p.ebrigade_start_time || null,
                ebrigade_end_time: p.ebrigade_end_time || null,
                pay_type: p.pay_type,
                analytic_id: p.analytic_id,
                analytic_code: p.analytic_code || null,
                analytic_name: p.ebrigade_activity_name || p.analytic_name || null,
                user_email: p.user_email,
                expense_amount: p.expense_amount || 0
              })
            })
            if (r.ok) {
              const d = await r.json()
              setEstimatedAmounts(s => ({...s, [p.id]: d.estimated_total}))
              setLoadedIds(s => new Set([...s, p.id]))
            }
          } catch (e) {
            console.error('load estimate failed for', p.id, e)
          }
        }
      })
      return newEstimates
    })
  }

  async function fetchItems(){
    setLoading(true)
    try{
      const r = await fetch('/api/admin/prestations')
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setItems(d.items || [])
    }catch(e){ console.error('fetch prestations failed', e); setItems([]) }
    setLoading(false)
  }

  async function updateStatus(id, status){
    if (savingIds[id]) return
    setSavingIds(prev=>({...prev, [id]: true}))
    try{
      const validatedById = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
      const validatedByEmail = typeof window !== 'undefined' ? localStorage.getItem('email') : null
      const validationPayload = status === "Envoyé à la facturation"
        ? { status, validated_by_id: validatedById ? Number(validatedById) : null, validated_by_email: validatedByEmail }
        : { status }
      const r = await fetch(`/api/admin/prestations/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(validationPayload) })
      if (!r.ok) throw new Error('update failed')
      const updated = await r.json()
      setItems(prev => prev.map(p => p.id === updated.id ? updated : p))
      // Show success notification
      if (status === "Envoyé à la facturation") {
        alert(`✅ Prestation envoyée à la comptabilité!\nFacture: ${updated.invoice_number || 'N/A'}\nLa comptabilité peut maintenant traiter le dossier.`)
      }
    }catch(e){ console.error('update status failed', e); alert('Erreur lors de la mise à jour') }
    finally{ setSavingIds(prev => { const c = {...prev}; delete c[id]; return c }) }
  }

  async function refusePrestation(id, reason){
    if (savingIds[id]) return
    setSavingIds(prev=>({...prev, [id]: true}))
    try{
      const r = await fetch(`/api/admin/prestations/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Annulé', refusalReason: reason }) })
      if (!r.ok) throw new Error('update failed')
      const updated = await r.json()
      setItems(prev => prev.map(p => p.id === updated.id ? updated : p))
      setRefusingId(null)
      setRefusalReason('')
    }catch(e){ console.error('refuse prestation failed', e); alert('Erreur lors du refus') }
    finally{ setSavingIds(prev => { const c = {...prev}; delete c[id]; return c }) }
  }

  async function bulkValidate() {
    setBulkValidating(true)
    const validatedById = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
    const validatedByEmail = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    let successCount = 0
    let failCount = 0
    for (const p of eligibleForBulk) {
      try {
        const r = await fetch(`/api/admin/prestations/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: "Envoyé à la facturation",
            validated_by_id: validatedById ? Number(validatedById) : null,
            validated_by_email: validatedByEmail
          })
        })
        if (r.ok) {
          const updated = await r.json()
          setItems(prev => prev.map(item => item.id === updated.id ? updated : item))
          successCount++
        } else {
          failCount++
        }
      } catch (e) {
        console.error('bulk validate failed for', p.id, e)
        failCount++
      }
    }
    setBulkValidating(false)
    setBulkConfirmOpen(false)
    alert(`✅ Validation en masse terminée :\n${successCount} prestation(s) validée(s)${failCount > 0 ? `\n⚠️ ${failCount} échec(s)` : ''}`)
  }

  const filtered = useMemo(() => {
    return items.filter(it => {
      // analytic filter for moderators
      if (filterAnalyticIds && filterAnalyticIds.length > 0) {
        const aid = String(it.analytic_id || '')
        if (!filterAnalyticIds.includes(aid)) return false
      }
      // user filter (search by firstName, lastName, email)
      if (userFilter) {
        const fullName = ((it.user_firstName || '') + ' ' + (it.user_lastName || '')).toLowerCase().trim()
        const email = (it.user_email || '').toLowerCase()
        const searchTerm = userFilter.toLowerCase()
        if (!fullName.includes(searchTerm) && !email.includes(searchTerm)) return false
      }
      // status
      if (statusFilter && (it.status || '') !== statusFilter) return false
      // date compare on YYYY-MM-DD
      const d = it.date ? String(it.date).slice(0,10) : ''
      if (dateFrom && (!d || d < dateFrom)) return false
      if (dateTo && (!d || d > dateTo)) return false
      return true
    })
  }, [items, statusFilter, dateFrom, dateTo, userFilter])

  const totalPages = Math.ceil((filtered?.length || 0) / limit)
  const startIdx = (currentPage - 1) * limit
  const endIdx = startIdx + limit

  const displayed = useMemo(() => (filtered || []).slice(startIdx, endIdx), [filtered, limit, currentPage, startIdx, endIdx])

  // Prestations éligibles pour la validation en masse :
  // - status "En attente d'approbation"
  // - durée eBrigade connue
  // - pas de sortie_hours > 0
  // - heures saisies = durée eBrigade (tolérance 0.01h pour floating point)
  const eligibleForBulk = useMemo(() => {
    return items.filter(p => {
      if (p.status !== "En attente d'approbation") return false
      if (filterAnalyticIds && filterAnalyticIds.length > 0) {
        const aid = String(p.analytic_id || '')
        if (!filterAnalyticIds.includes(aid)) return false
      }
      // Exclure les prestations avec une note de frais (vérification manuelle requise)
      if (Number(p.expense_amount || 0) > 0) return false
      const duration = inferDurationHours(p)
      if (!duration || duration <= 0) return false
      const sortie = Number(p.sortie_hours ?? -1)
      if (sortie > 0) return false
      // sortie_hours = 0 explicitement → garde couvre toute la durée eBrigade → éligible
      if (p.sortie_hours !== null && p.sortie_hours !== undefined && sortie === 0) return true
      const garde = Number(p.garde_hours || 0)
      const actual = Number(p.hours_actual || 0)
      const totalHours = garde > 0 ? garde : actual
      return Math.abs(totalHours - duration) < 0.01
    })
  }, [items, filterAnalyticIds])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, dateFrom, dateTo, userFilter])

  useEffect(() => {
    if (filtered && filtered.length > 0) {
      loadEstimatedAmounts(filtered)
    }
  }, [filtered])

  return (
    <div className="card">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <h2 style={{marginTop:0}}>Demandes de prestations</h2>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:13,color:'#6b7280',fontWeight:600}}>Du</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #d1d5db',fontSize:13}} />
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:13,color:'#6b7280',fontWeight:600}}>Au</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #d1d5db',fontSize:13}} />
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:13,color:'#6b7280',fontWeight:600}}>Utilisateur</span>
          <input type="text" value={userFilter} onChange={e=>setUserFilter(e.target.value)} placeholder="Nom, prénom ou email..." style={{padding:'6px 8px',borderRadius:6,border:'1px solid #d1d5db',fontSize:13,minWidth:200}} />
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:13,color:'#6b7280',fontWeight:600}}>Statut</span>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #d1d5db',fontSize:13}}>
            {statuses.map(s => <option key={s} value={s}>{s || 'Tous'}</option>)}
          </select>
        </label>
        <button
          onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter("En attente d'approbation"); setUserFilter('') }}
          style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}
          onMouseEnter={(e)=>e.currentTarget.style.background='#f3f4f6'}
          onMouseLeave={(e)=>e.currentTarget.style.background='#fff'}
        >🔄 Réinitialiser</button>
        {eligibleForBulk.length > 0 && (
          <button
            onClick={() => setBulkConfirmOpen(true)}
            style={{padding:'6px 14px',borderRadius:6,border:'1px solid #16a34a',background:'#dcfce7',color:'#15803d',cursor:'pointer',fontWeight:700,fontSize:13,transition:'all 0.2s',marginLeft:8}}
            onMouseEnter={(e)=>e.currentTarget.style.background='#bbf7d0'}
            onMouseLeave={(e)=>e.currentTarget.style.background='#dcfce7'}
          >⚡ Valider en masse ({eligibleForBulk.length})</button>
        )}
      </div>
      {loading ? <div className="small-muted">Chargement...</div> : (
        <table style={{width:'100%',borderCollapse:'collapse',borderRadius:8,overflow:'hidden'}}>
          <thead>
            <tr style={{background:'#f3f4f6',borderBottom:'2px solid #e5e7eb'}}>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>ID</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Utilisateur</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Date</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Type</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Analytique</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Montant</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Statut</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Validé par</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr><td colSpan={9} style={{padding:24,textAlign:'center',background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                <div style={{color:'#6b7280',marginBottom:10}}>
                  {statusFilter || dateFrom || dateTo || userFilter
                    ? `Aucune demande pour le filtre actuel.`
                    : 'Aucune demande'}
                </div>
                {(statusFilter || dateFrom || dateTo || userFilter) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setUserFilter('') }}
                    style={{padding:'6px 14px',borderRadius:6,border:'1px solid #6366f1',background:'#eef2ff',color:'#4338ca',cursor:'pointer',fontWeight:600,fontSize:13}}
                  >
                    Voir toutes les demandes
                  </button>
                )}
              </td></tr>
            )}
            {displayed.map((it, idx) => (
              <tr key={it.id} style={{
                background: savingIds[it.id] ? '#fef9c3' : (idx % 2 === 0 ? '#fff' : '#f9fafb'),
                borderBottom:'1px solid #e5e7eb',
                transition:'background-color 0.3s',
                opacity: savingIds[it.id] ? 0.75 : 1,
                pointerEvents: savingIds[it.id] ? 'none' : 'auto',
              }}
              onMouseEnter={(e)=>{ if (!savingIds[it.id]) e.currentTarget.style.background='#eff6ff' }}
              onMouseLeave={(e)=>{ if (!savingIds[it.id]) e.currentTarget.style.background=(idx % 2 === 0 ? '#fff' : '#f9fafb') }}
              >
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}><strong>#{it.id}</strong></td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>
                  <div style={{fontWeight:500}}>{it.user_firstname && it.user_lastname ? `${it.user_firstname} ${it.user_lastname}` : (it.user_email || '-')}</div>
                </td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>{formatDate(it.date)}</td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>{it.pay_type || '-'}</td>
                <td style={{padding:12,fontSize:14}}>
                  {(it.analytic_name || it.ebrigade_activity_name || it.ebrigade_activity_type || it.analytic_code) ? (
                    <span style={{display:'inline-block',padding:'3px 8px',borderRadius:4,background:'#ede9fe',color:'#5b21b6',fontWeight:600,fontSize:12}}>
                      {it.analytic_name || it.ebrigade_activity_name || it.ebrigade_activity_type || it.analytic_code}
                    </span>
                  ) : <span style={{color:'#d1d5db'}}>-</span>}
                </td>
                <td style={{padding:12,fontSize:14,fontWeight:600,color:'#10b981'}}>
                  {(() => {
                    const rc = (it.role_codes || '').toUpperCase()
                    const isInfi = rc.includes('INFI')
                    const isMed = rc.includes('MED') && !isInfi
                    const amt = isMed ? it.remuneration_med : it.remuneration_infi
                    if (estimatedAmounts[it.id]) return `${estimatedAmounts[it.id]} \u20ac`
                    if (amt != null && amt > 0) return `${amt}\u20ac`
                    return '-'
                  })()}
                </td>
                <td style={{padding:12,fontSize:14}}>
                  <span style={{
                    padding:'4px 10px',
                    borderRadius:6,
                    fontSize:12,
                    fontWeight:600,
                    background: it.status === "En attente d'envoie" ? '#fef3c7' : 
                                it.status === "Envoyé à la facturation" ? '#dcfce7' :
                                it.status === "Annulé" ? '#fee2e2' :
                                it.status === "A saisir" ? '#fecaca' : '#e0e7ff',
                    color: it.status === "En attente d'envoie" ? '#92400e' :
                           it.status === "Envoyé à la facturation" ? '#166534' :
                           it.status === "Annulé" ? '#991b1b' :
                           it.status === "A saisir" ? '#b91c1c' : '#3730a3'
                  }}>
                    {it.status || '-'}
                  </span>
                </td>
                <td style={{padding:12,fontSize:14,color:'#6b7280'}}>
                  {it.validated_at ? (
                    <div>
                      <div style={{fontWeight:500,color:'#1f2937'}}>
                        {it.validated_by_first_name && it.validated_by_last_name 
                          ? `${it.validated_by_first_name} ${it.validated_by_last_name}`
                          : (it.validated_by_email || '-')}
                      </div>
                      <div style={{fontSize:12,color:'#9ca3af'}}>
                        {new Date(it.validated_at).toLocaleDateString('fr-FR', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                  ) : (
                    <span style={{color:'#d1d5db'}}>-</span>
                  )}
                </td>
                <td style={{padding:12,fontSize:14}}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button disabled={!!savingIds[it.id]} onClick={()=>setViewing(it)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:'#e0e7ff',color:'#3730a3',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}>👁️ Voir</button>
                    {it.pdf_url && <a href={it.pdf_url.replace(/^\/exports\//, '/api/exports/download?file=')} download style={{padding:'6px 12px',borderRadius:6,border:'1px solid #c7d2fe',background:'#e0e7ff',color:'#3730a3',cursor:'pointer',fontWeight:600,fontSize:13,textDecoration:'none',display:'inline-block',transition:'all 0.2s'}}>📄 Facture</a>}
                    {it.status === "En attente d'approbation" && (
                      <>
                        <button
                          disabled={!!savingIds[it.id]}
                          onClick={()=>updateStatus(it.id, "Envoyé à la facturation")}
                          style={{padding:'6px 12px',borderRadius:6,border:'1px solid #fcd34d',background: savingIds[it.id] ? '#fde68a' : '#fef3c7',color:'#92400e',cursor: savingIds[it.id] ? 'not-allowed' : 'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s',display:'flex',alignItems:'center',gap:6,minWidth:100,justifyContent:'center'}}
                        >
                          {savingIds[it.id] ? (
                            <>
                              <span style={{display:'inline-block',width:13,height:13,border:'2px solid #92400e',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}} />
                              Génération…
                            </>
                          ) : '✓ Valider'}
                        </button>
                        <button disabled={!!savingIds[it.id]} onClick={()=>setRefusingId(it.id)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #fca5a5',background:'#fee2e2',color:'#991b1b',cursor: savingIds[it.id] ? 'not-allowed' : 'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s',opacity: savingIds[it.id] ? 0.5 : 1}}>✕ Refuser</button>
                      </>
                    )}
                    <button
                      disabled={!!savingIds[it.id]}
                      onClick={async () => {
                        if (!confirm('Supprimer cette prestation ? Elle repassera au statut "À saisir" pour l\'utilisateur.')) return
                        setSavingIds(prev => ({...prev, [it.id]: true}))
                        try {
                          const r = await fetch(`/api/admin/prestations/${it.id}`, { method: 'DELETE' })
                          if (r.ok) {
                            setItems(prev => prev.filter(p => p.id !== it.id))
                          } else {
                            alert('Erreur lors de la suppression')
                          }
                        } finally {
                          setSavingIds(prev => {const n={...prev}; delete n[it.id]; return n})
                        }
                      }}
                      style={{padding:'6px 12px',borderRadius:6,border:'1px solid #fca5a5',background:'#fee2e2',color:'#991b1b',cursor: savingIds[it.id] ? 'not-allowed' : 'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s',opacity: savingIds[it.id] ? 0.5 : 1}}
                    >🗑️ Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:16,flexWrap:'wrap'}}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:currentPage === 1 ? '#f3f4f6' : '#fff',color:currentPage === 1 ? '#9ca3af' : '#1f2937',cursor:currentPage === 1 ? 'not-allowed' : 'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}
          >← Précédent</button>
          {Array.from({length: totalPages}, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              style={{padding:'6px 10px',borderRadius:6,border: pageNum === currentPage ? '2px solid #3b82f6' : '1px solid #d1d5db',background: pageNum === currentPage ? '#dbeafe' : '#fff',color: pageNum === currentPage ? '#1e40af' : '#1f2937',cursor:'pointer',fontWeight: pageNum === currentPage ? 700 : 600,fontSize:13,transition:'all 0.2s',minWidth:36,textAlign:'center'}}
            >{pageNum}</button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:currentPage === totalPages ? '#f3f4f6' : '#fff',color:currentPage === totalPages ? '#9ca3af' : '#1f2937',cursor:currentPage === totalPages ? 'not-allowed' : 'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}
          >Suivant →</button>
          <span style={{fontSize:12,color:'#6b7280',marginLeft:8}}>Page {currentPage} sur {totalPages}</span>
        </div>
      )}
      {/* Modal confirmation validation en masse */}
      {bulkConfirmOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:20}}>
          <div style={{width:'100%',maxWidth:640,background:'#fff',borderRadius:12,boxShadow:'0 20px 25px -5px rgba(0,0,0,0.15)',overflow:'auto',maxHeight:'80vh'}}>
            <div style={{padding:20,borderBottom:'1px solid #e5e7eb',background:'#f0fdf4'}}>
              <h3 style={{margin:0,fontSize:18,fontWeight:700,color:'#15803d'}}>⚡ Validation en masse — {eligibleForBulk.length} prestation(s)</h3>
              <p style={{margin:'6px 0 0',fontSize:13,color:'#4b5563'}}>Les prestations suivantes correspondent exactement à la durée eBrigade, sans heures de sortie.</p>
            </div>
            <div style={{padding:16,overflowY:'auto',maxHeight:'45vh'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                    <th style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:700}}>ID</th>
                    <th style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:700}}>Utilisateur</th>
                    <th style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:700}}>Date</th>
                    <th style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:700}}>Analytique</th>
                    <th style={{padding:'8px 10px',textAlign:'right',color:'#374151',fontWeight:700}}>Heures</th>
                    <th style={{padding:'8px 10px',textAlign:'right',color:'#374151',fontWeight:700}}>Durée eBrigade</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleForBulk.map((p, i) => (
                    <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6',background: i % 2 === 0 ? '#fff' : '#f9fafb'}}>
                      <td style={{padding:'8px 10px',fontWeight:600}}>#{p.id}</td>
                      <td style={{padding:'8px 10px'}}>{p.user_firstname && p.user_lastname ? `${p.user_firstname} ${p.user_lastname}` : (p.user_email || '-')}</td>
                      <td style={{padding:'8px 10px'}}>{formatDate(p.date)}</td>
                      <td style={{padding:'8px 10px',color:'#5b21b6',fontWeight:500}}>{p.ebrigade_activity_name || p.analytic_name || '-'}</td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{(Number(p.garde_hours || 0) > 0 ? Number(p.garde_hours) : Number(p.hours_actual || 0))}h</td>
                      <td style={{padding:'8px 10px',textAlign:'right',color:'#16a34a',fontWeight:600}}>{inferDurationHours(p)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:16,borderTop:'1px solid #e5e7eb',display:'flex',gap:10,justifyContent:'flex-end',background:'#f9fafb'}}>
              <button
                onClick={() => setBulkConfirmOpen(false)}
                disabled={bulkValidating}
                style={{padding:'8px 18px',borderRadius:6,border:'1px solid #d1d5db',background:'#fff',color:'#374151',cursor:'pointer',fontWeight:600,fontSize:14}}
              >Annuler</button>
              <button
                onClick={bulkValidate}
                disabled={bulkValidating}
                style={{padding:'8px 18px',borderRadius:6,border:'1px solid #16a34a',background: bulkValidating ? '#dcfce7' : '#16a34a',color:'#fff',cursor: bulkValidating ? 'not-allowed' : 'pointer',fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8}}
              >
                {bulkValidating ? (
                  <><span style={{display:'inline-block',width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />Validation en cours…</>
                ) : `✓ Confirmer (${eligibleForBulk.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <div style={{width:'100%',maxWidth:800,background:'#fff',borderRadius:12,boxShadow:'0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',overflow:'auto',maxHeight:'90vh'}}>
            <div style={{padding:24,borderBottom:'1px solid #e5e7eb'}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#1f2937'}}>
                📋 {viewing.ebrigade_activity_name || viewing.analytic_name ? `${viewing.ebrigade_activity_name || viewing.analytic_name} - ` : ''}Détails demande #{viewing.id}
              </h3>
            </div>

            <div style={{padding:24}}>
              {/* User & Document Info */}
              <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb',marginBottom:16}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>UTILISATEUR</div>
                    <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{viewing.user_firstname && viewing.user_lastname ? `${viewing.user_firstname} ${viewing.user_lastname}` : (viewing.user_email || '-')}</div>
                  </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>DATE</div>
                      <div style={{fontSize:15,color:'#1f2937'}}>{formatDate(viewing.date)}</div>
                    </div>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>TYPE</div>
                    <div style={{fontSize:15,color:'#1f2937'}}>{viewing.pay_type || '-'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>ANALYTIQUE</div>
                    <div style={{fontSize:15,color:'#1f2937'}}>
                      {viewing.ebrigade_activity_name || viewing.ebrigade_activity_type || viewing.analytic_name || viewing.analytic_code || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>ID EBRIGADE</div>
                    <div style={{fontSize:15,color:'#1f2937'}}>{viewing.ebrigade_activity_code || '-'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>STATUT</div>
                    <div style={{fontSize:15,fontWeight:600,color:viewing.status === "En attente d'envoie" ? '#f59e0b' : viewing.status === "Envoyé à la facturation" ? '#10b981' : '#991b1b'}}>{viewing.status || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Section Heures */}
              <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb',marginBottom:16}}>
                <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>📊 Heures de travail</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {viewing.hours_actual !== null && viewing.hours_actual !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES RÉELLES</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{normalizeBreakdown(viewing).hours_actual}</div>
                    </div>
                  )}
                  {viewing.pay_type !== 'APS' && viewing.garde_hours !== null && viewing.garde_hours !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{normalizeBreakdown(viewing).garde_hours}</div>
                    </div>
                  )}
                  {viewing.sortie_hours !== null && viewing.sortie_hours !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{normalizeBreakdown(viewing).sortie_hours}</div>
                    </div>
                  )}
                  {normalizeBreakdown(viewing).overtime_hours > 0 && (
                    <div>
                      <div style={{fontSize:12,color:'#f97316',fontWeight:600,marginBottom:6}}>HEURES SUPPLÉMENTAIRES</div>
                      <div style={{fontSize:15,color:'#f97316',fontWeight:500}}>{normalizeBreakdown(viewing).overtime_hours}</div>
                    </div>
                  )}
                </div>
              </div>



              {/* Section Tarifs & Calcul de l'activité locale */}
              {activityRates[viewing.id] && (() => {
                // Combine role_codes (from user_roles table) and user_role (from users.role column)
                const roleSrc = viewing.role_codes || ''
                const userRoleSrc = (() => {
                  const r = viewing.user_role || ''
                  if (Array.isArray(r)) return r.join(',')
                  try { const p = JSON.parse(r); return Array.isArray(p) ? p.join(',') : r } catch { return r }
                })()
                const rc = (roleSrc + ',' + userRoleSrc).toUpperCase()
                const isInfi = rc.includes('INFI')
                const isMed = rc.includes('MED') && !isInfi
                const d = activityRates[viewing.id].detailed || {}
                const hasRole = isInfi || isMed
                const normalizedViewing = normalizeBreakdown(viewing)
                // If role is known: show only that role's calc; if unknown: show both
                const showInfiDetail = !hasRole || !isMed
                const showMedDetail = !hasRole || !isInfi
                return (
                <div style={{padding:12,border:'1px solid #d97706',borderRadius:8,background:'#fffbeb',marginBottom:16}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#92400e'}}>📍 Tarifs de l'activité locale</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    {!isMed && d.garde_infi != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>GARDE - INFIRMIER</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{d.garde_infi} €/h</div>
                      </div>
                    )}
                    {!isInfi && d.garde_med != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>GARDE - MÉDECIN</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{d.garde_med} €/h</div>
                      </div>
                    )}
                    {!isMed && d.sortie_infi != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>SORTIE - INFIRMIER</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{d.sortie_infi} €/h</div>
                      </div>
                    )}
                    {!isInfi && d.sortie_med != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>SORTIE - MÉDECIN</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{d.sortie_med} €/h</div>
                      </div>
                    )}
                  </div>

                  {/* Detailed calculation breakdown - only for user's role */}
                  {(normalizedViewing.garde_hours || normalizedViewing.sortie_hours || normalizedViewing.hours_actual || viewing.expense_amount) && d && (
                    <div style={{fontSize:11,color:'#92400e',padding:10,background:'#fff',borderRadius:6,border:'1px solid #fcd34d',fontFamily:'monospace',lineHeight:'1.6'}}>
                      <div style={{fontWeight:700,marginBottom:8,color:'#b45309'}}>Calcul détaillé:</div>
                      {showInfiDetail && d.garde_infi != null && (
                        <div>
                          {normalizedViewing.garde_hours || normalizedViewing.sortie_hours ? (
                            <>
                              <div>Infirmier: ({normalizedViewing.garde_hours || 0}h × {d.garde_infi}€) + ({normalizedViewing.sortie_hours || 0}h × {d.sortie_infi || 0}€) {normalizedViewing.overtime_hours ? `+ (${normalizedViewing.overtime_hours}h × ${!normalizedViewing.garde_hours ? (d.sortie_infi || d.garde_infi) : d.garde_infi}€)` : ''}</div>
                              <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {(() => {
                                const garde = (normalizedViewing.garde_hours || 0) * (d.garde_infi || 0)
                                const sortie = (normalizedViewing.sortie_hours || 0) * (d.sortie_infi || 0)
                                const otRate = !normalizedViewing.garde_hours ? (d.sortie_infi || d.garde_infi || 0) : (d.garde_infi || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * otRate
                                return Math.round((garde + sortie + ot + Number.EPSILON) * 100) / 100
                              })()} €</div>
                            </>
                          ) : (
                            <>
                              <div>Infirmier: ({normalizedViewing.hours_actual || 0}h × {d.garde_infi}€){normalizedViewing.overtime_hours ? ` + (${normalizedViewing.overtime_hours}h × ${d.garde_infi}€)` : ''}</div>
                              <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {(() => {
                                const total = (normalizedViewing.hours_actual || 0) * (d.garde_infi || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * (d.garde_infi || 0)
                                return Math.round((total + ot + Number.EPSILON) * 100) / 100
                              })()} €</div>
                            </>
                          )}
                        </div>
                      )}
                      {showMedDetail && d.garde_med != null && (
                        <div style={{marginTop:6}}>
                          {normalizedViewing.garde_hours || normalizedViewing.sortie_hours ? (
                            <>
                              <div>Médecin: ({normalizedViewing.garde_hours || 0}h × {d.garde_med}€) + ({normalizedViewing.sortie_hours || 0}h × {d.sortie_med || 0}€) {normalizedViewing.overtime_hours ? `+ (${normalizedViewing.overtime_hours}h × ${!normalizedViewing.garde_hours ? (d.sortie_med || d.garde_med) : d.garde_med}€)` : ''}</div>
                              <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {(() => {
                                const garde = (normalizedViewing.garde_hours || 0) * (d.garde_med || 0)
                                const sortie = (normalizedViewing.sortie_hours || 0) * (d.sortie_med || 0)
                                const otRate = !normalizedViewing.garde_hours ? (d.sortie_med || d.garde_med || 0) : (d.garde_med || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * otRate
                                return Math.round((garde + sortie + ot + Number.EPSILON) * 100) / 100
                              })()} €</div>
                            </>
                          ) : (
                            <>
                              <div>Médecin: ({normalizedViewing.hours_actual || 0}h × {d.garde_med}€){normalizedViewing.overtime_hours ? ` + (${normalizedViewing.overtime_hours}h × ${d.garde_med}€)` : ''}</div>
                              <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {(() => {
                                const total = (normalizedViewing.hours_actual || 0) * (d.garde_med || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * (d.garde_med || 0)
                                return Math.round((total + ot + Number.EPSILON) * 100) / 100
                              })()} €</div>
                            </>
                          )}
                        </div>
                      )}
                      {viewing.expense_amount > 0 && (
                        <div style={{marginTop:6,paddingTop:6,borderTop:'1px dashed #fcd34d'}}>
                          <div>Note de frais: {Number(viewing.expense_amount)} €{viewing.expense_comment ? ` (${viewing.expense_comment})` : ''}</div>
                          <div style={{fontWeight:700,color:'#b45309',marginTop:4,borderTop:'1px solid #fcd34d',paddingTop:4}}>= Total: {(() => {
                            const exp = Number(viewing.expense_amount || 0)
                            if (showInfiDetail && d.garde_infi != null) {
                              if (normalizedViewing.garde_hours || normalizedViewing.sortie_hours) {
                                const garde = (normalizedViewing.garde_hours || 0) * (d.garde_infi || 0)
                                const sortie = (normalizedViewing.sortie_hours || 0) * (d.sortie_infi || 0)
                                const otRate = !normalizedViewing.garde_hours ? (d.sortie_infi || d.garde_infi || 0) : (d.garde_infi || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * otRate
                                return Math.round((garde + sortie + ot + exp + Number.EPSILON) * 100) / 100
                              } else {
                                const total = (normalizedViewing.hours_actual || 0) * (d.garde_infi || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * (d.garde_infi || 0)
                                return Math.round((total + ot + exp + Number.EPSILON) * 100) / 100
                              }
                            } else if (showMedDetail && d.garde_med != null) {
                              if (normalizedViewing.garde_hours || normalizedViewing.sortie_hours) {
                                const garde = (normalizedViewing.garde_hours || 0) * (d.garde_med || 0)
                                const sortie = (normalizedViewing.sortie_hours || 0) * (d.sortie_med || 0)
                                const otRate = !normalizedViewing.garde_hours ? (d.sortie_med || d.garde_med || 0) : (d.garde_med || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * otRate
                                return Math.round((garde + sortie + ot + exp + Number.EPSILON) * 100) / 100
                              } else {
                                const total = (normalizedViewing.hours_actual || 0) * (d.garde_med || 0)
                                const ot = (normalizedViewing.overtime_hours || 0) * (d.garde_med || 0)
                                return Math.round((total + ot + exp + Number.EPSILON) * 100) / 100
                              }
                            }
                            return exp
                          })()} €</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
              })()}

              {/* Section Commentaires */}
              {viewing.comments && (
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb',marginBottom:16}}>
                  <div style={{fontWeight:700,marginBottom:8,fontSize:14,color:'#1f2937'}}>💬 Commentaires</div>
                  <div style={{whiteSpace:'pre-wrap',fontSize:14,color:'#374151',lineHeight:'1.5'}}>{viewing.comments}</div>
                </div>
              )}

              {/* Section Note de frais */}
              {(viewing.expense_amount || viewing.expense_comment || viewing.proof_image) && (
                <div style={{padding:12,border:'1px solid #f59e0b',borderRadius:8,background:'#fffbeb',marginBottom:16}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#92400e'}}>🧾 Note de frais</div>
                  <div style={{display:'grid',gap:12}}>
                    {viewing.expense_amount && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>MONTANT</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#d97706'}}>{viewing.expense_amount} €</div>
                      </div>
                    )}
                    {viewing.expense_comment && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>COMMENTAIRE</div>
                        <div style={{fontSize:14,color:'#92400e'}}>{viewing.expense_comment}</div>
                      </div>
                    )}
                    {viewing.proof_image && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>📸 JUSTIFICATIF</div>
                        <a href={viewing.proof_image} target="_blank" rel="noopener noreferrer">
                          <img src={viewing.proof_image} alt="ticket" style={{maxWidth:'100%',maxHeight:250,border:'2px solid #fcd34d',borderRadius:6,display:'block',cursor:'pointer'}} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{padding:24,borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>setViewing(null)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #d1d5db',background:'#fff',color:'#1f2937',cursor:'pointer',fontWeight:600,fontSize:14}}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Refusal Modal */}
      {refusingId && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1001,padding:20}}>
          <div style={{width:'100%',maxWidth:500,background:'#fff',borderRadius:12,boxShadow:'0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',overflow:'auto'}}>
            <div style={{padding:24,borderBottom:'1px solid #e5e7eb'}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#1f2937'}}>⚠️ Refuser cette demande</h3>
            </div>

            <div style={{padding:24}}>
              <label style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1f2937'}}>Raison du refus</div>
                <textarea
                  value={refusalReason}
                  onChange={e=>setRefusalReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette demande est refusée..."
                  style={{minHeight:120,padding:12,borderRadius:6,border:'1px solid #d1d5db',fontSize:14,fontFamily:'inherit',resize:'vertical'}}
                />
              </label>
            </div>

            <div style={{padding:24,borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>{ setRefusingId(null); setRefusalReason('') }} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #d1d5db',background:'#fff',color:'#1f2937',cursor:'pointer',fontWeight:600,fontSize:14}}>Annuler</button>
              <button onClick={()=>refusePrestation(refusingId, refusalReason)} disabled={!refusalReason.trim() || !!savingIds[refusingId]} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #fca5a5',background:'#fee2e2',color:'#991b1b',cursor:'pointer',fontWeight:600,fontSize:14,opacity: !refusalReason.trim() ? 0.5 : 1}}>Confirmer le refus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
