import React, { useEffect, useMemo, useState } from 'react'

export default function PrestationsTable({ email }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showUpcoming, setShowUpcoming] = useState(false)

  // modal
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmPreview, setConfirmPreview] = useState(null)
  // read role from localStorage into reactive state so updates are picked up
  const [clientRole, setClientRole] = useState(typeof window !== 'undefined' ? localStorage.getItem('role') : null)

  // Handle closing the modal
  const handleCloseModal = () => {
    setEditing(null)
    setConfirmOpen(false)
    setConfirmPreview(null)
  }

  useEffect(()=>{
    if (typeof window === 'undefined') return
    const val = localStorage.getItem('role')
    setClientRole(val)
    function onStorage(e){
      if (e.key === 'role') setClientRole(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  }, [])
  // keep existing code using `role` working by aliasing to `clientRole`
  const role = clientRole || null

  // Derived flags for the edit modal rendering
  // Use ebrigade_activity_type if available (explicit), otherwise fall back to pay_type
  const _editTypeSourceLower = (editing && (editing.ebrigade_activity_type || editing.pay_type)) 
    ? String(editing.ebrigade_activity_type || editing.pay_type).toLowerCase() 
    : ''
  const editingIsGarde = _editTypeSourceLower.includes('garde')
  const editingIsPermanence = _editTypeSourceLower.includes('permanence')
  const editingIsAPS = _editTypeSourceLower.includes('aps')

  useEffect(() => {
    // Fetch both prestations and available activities
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (email) {
          // Fetch user prestations
          const prestRes = await fetch(`/api/prestations?email=${encodeURIComponent(email)}`)
          if (!prestRes.ok) throw new Error('Échec de la récupération des prestations')
          const prestData = await prestRes.json()
          const prestations = prestData.prestations || []
          console.log('Prestations loaded:', prestations)

          // Fetch available activities
          const actRes = await fetch(`/api/activities?email=${encodeURIComponent(email)}`)
          if (!actRes.ok) throw new Error(`Échec activities API: ${actRes.status}`)
          const actData = await actRes.json()
          console.log('Activities API response:', actData)
          const activities = (actData.activities || []).map(a => ({
            ...a,
            isActivity: true,  // Mark as activity to distinguish from prestation
            status: 'À saisir',  // Default status for activities
            id: `act_${a.id}`,  // Prefix ID to avoid collisions
            originalActivityId: a.id
          }))
          console.log('Activities mapped:', activities)

          // Combine and sort by date (newest first)
          const combined = [...activities, ...prestations].sort((a, b) => {
            const dateA = new Date(a.date || 0)
            const dateB = new Date(b.date || 0)
            return dateB - dateA
          })
          console.log('Combined items:', combined)

          setItems(combined)
        } else if (clientRole === 'admin') {
          const r = await fetch('/api/admin/prestations')
          if (!r.ok) throw new Error('Échec de la récupération (admin)')
          const data = await r.json()
          setItems(data.items || [])
        } else {
          setError('Utilisateur non connecté')
        }
      } catch (err) {
        console.error('Load error:', err)
        setError(err.message || 'Erreur')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [email, role])

  // consistent status set matching workflow
  const statuses = useMemo(() => [
    'A saisir',
    "En attente d'approbation",
    "En attente d'envoie",
    'Envoyé à la facturation',
    'Annulé'
  ], [])

  function isFilled(p){
    // consider a prestation filled if it has any of these fields
    return (p.hours_actual != null) || (p.remuneration_infi != null) || (p.remuneration_med != null)
  }

  function renderStatusBadge(s){
    const label = s || '-'
    const color = (
      s === "Envoyé à la facturation" ? '#16a34a' :
      s === "En attente d'envoie" ? '#0366d6' :
      s === "En attente d'approbation" ? '#f59e0b' :
      s === 'A saisir' ? '#9ca3af' :
      s === 'Annulé' ? '#ef4444' : '#6b7280'
    )
    return (
      <span style={{display:'inline-block',padding:'4px 8px',borderRadius:999,background:color+'22',color:color,fontWeight:600,fontSize:12}}>
        {label}
      </span>
    )
  }

  const today = new Date().toISOString().slice(0,10)
  const filtered = items.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false
    // showUpcoming now filters to show only items that need hours to be declared (not filled)
    if (showUpcoming){ if (isFilled(p)) return false }
    if (dateFrom){ if (!p.date || p.date < dateFrom) return false }
    if (dateTo){ if (!p.date || p.date > dateTo) return false }
    return true
  })

  async function openEdit(p){
    // If this is an activity (not a prestation), create a new prestation from it
    if (p.isActivity) {
      setEditing({
        id: null,
        analytic_id: p.analytic_id,
        analytic_name: p.analytic_name,
        analytic_code: p.analytic_code,
        pay_type: p.pay_type,
        date: p.date,
        remuneration_infi: p.remuneration_infi,
        remuneration_med: p.remuneration_med,
        hours_actual: null,
        garde_hours: null,
        sortie_hours: null,
        overtime_hours: null,
        status: 'A saisir',
        user_email: email,
        expense_amount: null,
        expense_comment: null,
        comments: null,
        proof_image: null
      })
      return
    }

    // For existing prestations, ensure invoice/request references exist
    try{
      if (!p.invoice_number && !p.request_ref){
        const resp = await fetch('/api/prestations/generate_invoice_number', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: p.id })
        })
        if (resp.ok){
          const data = await resp.json()
          const prest = data.prestation || data
          setEditing({...p, ...prest})
          return
        }
      }
    }catch(e){ /* ignore and fall back to local object */ }
    setEditing({...p})
  }

  // responsive: detect mobile width to render simplified cards
  const [isMobile, setIsMobile] = useState(false)
  useEffect(()=>{
    function update(){
      if (typeof window === 'undefined') return
      setIsMobile(window.innerWidth <= 720)
    }
    update()
    window.addEventListener('resize', update)
    return ()=> window.removeEventListener('resize', update)
  }, [])

  async function saveEdit(confirmed = false){
    if (!editing) return
    
    // For new prestations (from activities), check we have required fields
    const isNewPrestation = !editing.id
    if (isNewPrestation && !editing.date) {
      alert('Veuillez sélectionner une date pour cette activité.')
      return
    }

    // Prevent saving if status is "En attente d'envoie"
    if (editing.status === "En attente d'envoie") {
      alert('Cette demande est en attente d\'envoie et ne peut plus être modifiée.')
      return
    }

    // Non-admin users require confirmation modal before actual save
    if (!confirmed && role !== 'admin'){
      // prepare preview: list hours and an estimated total
      const preview = {
        hours_actual: editing.hours_actual || 0,
        garde_hours: editing.garde_hours || 0,
        sortie_hours: editing.sortie_hours || 0,
        overtime_hours: editing.overtime_hours || 0,
        expense_amount: editing.expense_amount || 0
      }

      // If the user provided explicit remuneration values, show them directly
      const providedRemu = (typeof editing.remuneration_infi !== 'undefined' && editing.remuneration_infi !== null) || (typeof editing.remuneration_med !== 'undefined' && editing.remuneration_med !== null)
      if (providedRemu){
        preview.estimated_infi = Number(editing.remuneration_infi || 0)
        preview.estimated_med = Number(editing.remuneration_med || 0)
        preview.rates = null
        // compute total respecting user's role (use stored role or editing object as fallback)
        const roleSource = clientRole || editing.user_role || editing.role || ''
        const roleLowSource = (roleSource || '').toLowerCase()
        const isMedSource = roleLowSource.includes('med') || roleLowSource.includes('médec') || roleLowSource.includes('doctor') || roleLowSource.includes('doc')
        const isInfiSource = roleLowSource.includes('infi') || roleLowSource.includes('infir') || roleLowSource.includes('infirm') || roleLowSource.includes('nurs')
        if (isMedSource) {
          preview.estimated_total = Math.round(((preview.estimated_med + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
        } else if (isInfiSource) {
          preview.estimated_total = Math.round(((preview.estimated_infi + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
        } else {
          preview.estimated_total = Math.round(((preview.estimated_infi + preview.estimated_med + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
        }
        setConfirmPreview(preview)
        setConfirmOpen(true)
        return
      }

      // Otherwise call server estimate endpoint to get authoritative rates and breakdown
      try{
        // debug: log current client/local role/email before requesting server estimate
        try{ console.debug('calling estimate', { clientRole, localRole: (typeof window !== 'undefined' ? localStorage.getItem('role') : null), localEmail: (typeof window !== 'undefined' ? localStorage.getItem('email') : null), editingEmail: editing.user_email || editing.email }) }catch(e){}
            const resp = await fetch('/api/prestations/estimate', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            garde_hours: preview.garde_hours,
            sortie_hours: preview.sortie_hours,
            overtime_hours: preview.overtime_hours,
            hours_actual: preview.hours_actual,
            pay_type: editing.pay_type,
            analytic_id: editing.analytic_id || null,
            // Do not send the literal 'user' role — let server resolve by email when role is non-canonical
            user_role: (clientRole && clientRole !== 'user') ? clientRole : (editing.user_role || null),
            user_email: (typeof window !== 'undefined' ? localStorage.getItem('email') : null) || editing.user_email || editing.email || null,
            expense_amount: preview.expense_amount || 0
          })
        })
        if (resp.ok){
          const data = await resp.json()
          preview.estimated_infi = data.estimated_infi
          preview.estimated_med = data.estimated_med
          preview.rates = data.rates
          // Prefer computing total from current user's role to match displayed breakdown
          const roleSourceLocal = role || (typeof window !== 'undefined' ? localStorage.getItem('role') : null) || editing.user_role || editing.role || ''
          const roleLowLocal = (roleSourceLocal || '').toLowerCase()
          console.debug('estimate response', { roleSourceLocal, respData: data })
          const isMedLocal = roleLowLocal.includes('med') || roleLowLocal.includes('médec') || roleLowLocal.includes('doctor') || roleLowLocal.includes('doc')
          const isInfiLocal = roleLowLocal.includes('infi') || roleLowLocal.includes('infir') || roleLowLocal.includes('infirm') || roleLowLocal.includes('nurs')
          if (isMedLocal) {
            preview.estimated_total = Math.round(((Number(preview.estimated_med || 0) + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
          } else if (isInfiLocal) {
            preview.estimated_total = Math.round(((Number(preview.estimated_infi || 0) + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
          } else {
            preview.estimated_total = data.estimated_total
          }
          setConfirmPreview(preview)
          setConfirmOpen(true)
          return
        }
      }catch(e){
        console.warn('estimate fetch failed, falling back to client heuristic', e)
      }

      // Fallback to client-side heuristic if server estimate fails
      const R_INF = 20
      const R_MED = 30
      const OT_MULT = 1.5
      // Use ebrigade_activity_type if available, otherwise pay_type
      const typeForEstimate = (editing.ebrigade_activity_type || editing.pay_type || '').toLowerCase()
      let estInfi = 0
      let estMed = 0
      if (typeForEstimate.includes('garde')) {
        const gh = Number(preview.garde_hours || 0)
        const sh = Number(preview.sortie_hours || 0)
        const oh = Number(preview.overtime_hours || 0)
        estInfi = (gh * R_INF) + (sh * R_INF) + (oh * R_INF * (OT_MULT))
        estMed = (gh * R_MED) + (sh * R_MED) + (oh * R_MED * (OT_MULT))
      } else {
        const ha = Number(preview.hours_actual || 0)
        const oh = Number(preview.overtime_hours || 0)
        estInfi = (ha * R_INF) + (oh * R_INF * (OT_MULT))
        estMed = (ha * R_MED) + (oh * R_MED * (OT_MULT))
      }
      const roleLow = (role || '').toLowerCase()
      const isMed = roleLow.includes('med') || roleLow.includes('médec') || roleLow.includes('doctor') || roleLow.includes('doc')
      const isInfi = roleLow.includes('infi') || roleLow.includes('infir') || roleLow.includes('infirm') || roleLow.includes('nurs')
      if (isMed) estInfi = 0
      if (isInfi) estMed = 0
      preview.estimated_infi = Math.round((estInfi + Number.EPSILON) * 100) / 100
      preview.estimated_med = Math.round((estMed + Number.EPSILON) * 100) / 100
      preview.rates = { infi: R_INF, med: R_MED, overtime_multiplier: OT_MULT }
      preview.estimated_total = Math.round(((estInfi + estMed + Number(preview.expense_amount || 0)) + Number.EPSILON) * 100) / 100
      setConfirmPreview(preview)
      setConfirmOpen(true)
      return
    }

    setSaving(true)
    try{
      const effective = {...editing}
      if (!role || (role !== 'admin' && role !== 'moderator')){
        effective.status = "En attente d'approbation"
      }
      // Use ebrigade_activity_type if available, otherwise pay_type
      const typeForSave = (effective.ebrigade_activity_type || effective.pay_type || '').toLowerCase()
      if (typeForSave.includes('permanence')){
        delete effective.remuneration_infi
        delete effective.remuneration_med
      }

      // Handle new prestation (POST) vs updating existing one (PATCH)
      let r
      if (isNewPrestation) {
        // Create new prestation
        r = await fetch('/api/admin/prestations', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(effective)
        })
      } else {
        // Update existing prestation
        r = await fetch(`/api/admin/prestations/${effective.id}`, {
          method: 'PATCH',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(effective)
        })
      }
      
      if (!r.ok) throw new Error('Échec enregistrement')
      const updated = await r.json()
      
      if (isNewPrestation) {
        // Add new prestation to list
        setItems((cur)=>[...cur, updated])
      } else {
        // Update existing prestation
        setItems((cur)=>cur.map(it=> it.id === updated.id ? {...it, ...updated} : it))
      }
      
      handleCloseModal()
    }catch(e){
      console.error('save failed', e)
      alert(e.message || 'Erreur')
    }finally{ setSaving(false) }
  }

  // Live estimate for displaying which rate will apply per line
  const [ratePreview, setRatePreview] = useState(null)
  useEffect(()=>{
    let cancelled = false
    async function doEstimate(){
      if (!editing) return
      try{
        const body = {
          garde_hours: editing.garde_hours || 0,
          sortie_hours: editing.sortie_hours || 0,
          overtime_hours: editing.overtime_hours || 0,
          hours_actual: editing.hours_actual || 0,
          pay_type: editing.pay_type || '',
          analytic_id: editing.analytic_id || null,
          user_role: (clientRole && clientRole !== 'user') ? clientRole : (editing.user_role || null),
          user_email: (typeof window !== 'undefined' ? localStorage.getItem('email') : null) || editing.user_email || editing.email || null,
          expense_amount: editing.expense_amount || 0
        }
        const r = await fetch('/api/prestations/estimate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
        if (!r.ok) return
        const data = await r.json()
        if (!cancelled) setRatePreview(data)
      }catch(e){ /* ignore */ }
    }
    doEstimate()
    return ()=>{ cancelled = true }
  }, [editing && editing.garde_hours, editing && editing.sortie_hours, editing && editing.overtime_hours, editing && editing.hours_actual, editing && editing.pay_type, editing && editing.analytic_id, clientRole])

  function confirmAndSave(){
    saveEdit(true)
  }

  if (loading) return <div className="card">Chargement des prestations…</div>
  if (error) return <div className="card">Erreur: {error}</div>

  return (
    <div>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
        <label style={{display:'flex',alignItems:'center',gap:6}}>Du
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6}}>Au
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6}}>Statut
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}}>
            <option value="">Tous</option>
            {statuses.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button
          onClick={()=>setShowUpcoming(v=>!v)}
          style={{background: showUpcoming ? '#111827' : '#0366d6', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer'}}
        >
          {showUpcoming ? 'Afficher tous' : 'Prestations à venir'}
        </button>
      </div>

      <div className="card">
        <h3>Mes prestations</h3>
        {filtered.length === 0 ? (
          <div className="small-muted">Aucune prestation trouvée.</div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:12}}>
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => p.status !== "En attente d'envoie" && openEdit(p)}
                style={{
                  background:'#fff',
                  border:'2px solid #e5e7eb',
                  borderRadius:12,
                  padding:16,
                  cursor:p.status === "En attente d'envoie" ? 'not-allowed' : 'pointer',
                  transition:'all 0.3s ease',
                  display:'flex',
                  flexDirection:'column',
                  gap:12,
                  boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                  opacity:p.status === "En attente d'envoie" ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (p.status !== "En attente d'envoie") {
                    e.currentTarget.style.borderColor = '#0366d6'
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(3, 102, 214, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-4px)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Header: Date et Type */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                  <div>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600}}>DATE</div>
                    <div style={{fontSize:18,fontWeight:700,color:'#1f2937'}}>
                      {p.date ? new Date(p.date).toLocaleDateString('fr-FR', {month:'short', day:'numeric'}) : '—'}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:4}}>STATUT</div>
                    {renderStatusBadge(p.status)}
                  </div>
                </div>

                {/* Type et Analytique */}
                <div>
                  <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:4}}>TYPE</div>
                  <div style={{fontSize:14,fontWeight:600,color:'#1f2937'}}>{p.pay_type || '—'}</div>
                </div>

                <div>
                  <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:4}}>ANALYTIQUE</div>
                  <div style={{fontSize:14,fontWeight:600,color:'#0366d6'}}>
                    {p.analytic_name || p.analytic_code || '—'}
                  </div>
                </div>

                {/* Heures et Montants si remplis */}
                {isFilled(p) && (
                  <div style={{padding:12,background:'#eff6ff',borderRadius:8,border:'1px solid #bfdbfe'}}>
                    <div style={{fontSize:11,color:'#0366d6',fontWeight:600,marginBottom:6}}>📋 DONNÉES SAISIES</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
                      {p.hours_actual != null && <div><div style={{color:'#6b7280'}}>Heures réelles</div><div style={{fontWeight:600,color:'#1f2937'}}>{p.hours_actual}h</div></div>}
                      {p.garde_hours != null && <div><div style={{color:'#6b7280'}}>Heures garde</div><div style={{fontWeight:600,color:'#1f2937'}}>{p.garde_hours}h</div></div>}
                      {p.sortie_hours != null && <div><div style={{color:'#6b7280'}}>Heures sortie</div><div style={{fontWeight:600,color:'#1f2937'}}>{p.sortie_hours}h</div></div>}
                      {p.overtime_hours != null && <div><div style={{color:'#6b7280'}}>Heures supp</div><div style={{fontWeight:600,color:'#1f2937'}}>{p.overtime_hours}h</div></div>}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{display:'flex',gap:8,marginTop:'auto'}}>
                  {p.pdf_url && (
                    <a href={p.pdf_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'8px 12px',borderRadius:6,background:'#dbeafe',color:'#0366d6',textDecoration:'none',cursor:'pointer',fontSize:13,fontWeight:600,border:'1px solid #93c5fd',transition:'all 0.2s'}} onMouseEnter={(e)=>{e.currentTarget.style.background='#bfdbfe';e.currentTarget.style.borderColor='#60a5fa'}} onMouseLeave={(e)=>{e.currentTarget.style.background='#dbeafe';e.currentTarget.style.borderColor='#93c5fd'}}>
                      <span>📄</span> PDF
                    </a>
                  )}
                  <button
                    onClick={(e)=>{ e.stopPropagation(); openEdit(p) }}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'8px 12px',borderRadius:6,background:p.isActivity ? '#dbeafe' : (p.status === "En attente d'envoie" ? '#f3f4f6' : '#e0e7ff'),color:p.isActivity ? '#0366d6' : (p.status === "En attente d'envoie" ? '#9ca3af' : '#4f46e5'),border:p.isActivity ? '1px solid #93c5fd' : (p.status === "En attente d'envoie" ? '1px solid #e5e7eb' : '1px solid #c7d2fe'),cursor:'pointer',fontSize:13,fontWeight:600,transition:'all 0.2s',opacity:p.status === "En attente d'envoie" && !p.isActivity ? 0.8 : 1}}
                    onMouseEnter={(e)=>{if(p.status !== "En attente d'envoie"){e.currentTarget.style.background=p.isActivity ? '#bfdbfe' : '#c7d2fe';e.currentTarget.style.borderColor=p.isActivity ? '#60a5fa' : '#a5b4fc'}}}
                    onMouseLeave={(e)=>{if(p.status !== "En attente d'envoie"){e.currentTarget.style.background=p.isActivity ? '#dbeafe' : '#e0e7ff';e.currentTarget.style.borderColor=p.isActivity ? '#93c5fd' : '#c7d2fe'}}}
                  >
                    <span>{p.isActivity ? '✏️' : (p.status === "En attente d'envoie" ? '👁️' : '✏️')}</span> {p.isActivity ? 'Déclarer heures' : (p.status === "En attente d'envoie" ? 'Consulter' : 'Voir')}
                  </button>
                </div>

                {/* Blocage warning */}
                {p.status === "En attente d'envoie" && <div style={{marginTop:6, fontSize:12, color:'#9ca3af', fontWeight:600, textAlign:'center'}}>🔒 En attente d'envoie</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / View modal */}
      {editing && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <div style={{width:'100%',maxWidth:800,background:'#fff',borderRadius:12,boxShadow:'0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',overflow:'auto',maxHeight:'90vh'}}>
            <div style={{padding:24,borderBottom:'1px solid #e5e7eb'}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#1f2937'}}>{
                (() => {
                  // For new prestations (activities)
                  if (!editing.id) return `✏️ Déclarer mes heures`
                  // Prefer showing the prestation reference (`request_ref`) as a 5-digit code when available
                  const ref = editing.request_ref || editing.invoice_number || ('#'+editing.id)
                  if (role === 'admin') return `📋 Détails demande ${ref}`
                  if (editing.status === "En attente d'envoie") return `👁️ Consulter prestation ${ref}`
                  return `✏️ Modifier prestation ${ref}`
                })()
              }</h3>
            </div>

            <div style={{padding:24}}>

            {editing.status === "En attente d'envoie" && role !== 'admin' && (
              <div style={{padding:12,background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:6,marginBottom:12,color:'#92400e',fontSize:13}}>
                <strong>🔒 Cette demande est en attente d'envoie</strong> — Vous pouvez consulter vos informations mais vous ne pouvez plus les modifier.
              </div>
            )}

            {role === 'admin' || editing.status === "En attente d'envoie" ? (
              // Admin read-only view OR blocked prestation: show submitted values with styled sections
              <div className="edit-grid" style={{gridTemplateColumns:'1fr',gap:16}}>
                {/* User & Document Info */}
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>UTILISATEUR</div>
                      <div style={{fontSize:15,color:'#1f2937'}}>{editing.user_email || editing.email || '-'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>DATE</div>
                      <div style={{fontSize:15,color:'#1f2937'}}>{editing.date || '-'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>TYPE</div>
                      <div style={{fontSize:15,color:'#1f2937'}}>{editing.pay_type || '-'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>ANALYTIQUE</div>
                      <div style={{fontSize:15,color:'#1f2937'}}>{editing.analytic_name || editing.analytic_code || '-'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>STATUT</div>
                      <div style={{fontSize:15,fontWeight:600,color:'#f59e0b'}}>{editing.status || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Section Heures */}
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>📊 Heures de travail</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    {editing.hours_actual !== null && editing.hours_actual !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES RÉELLES</div>
                        <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{editing.hours_actual}</div>
                      </div>
                    )}
                    {editing.garde_hours !== null && editing.garde_hours !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE</div>
                        <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{editing.garde_hours}</div>
                      </div>
                    )}
                    {editing.sortie_hours !== null && editing.sortie_hours !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                        <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{editing.sortie_hours}</div>
                      </div>
                    )}
                    {editing.overtime_hours !== null && editing.overtime_hours !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SUPPLÉMENTAIRES</div>
                        <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{editing.overtime_hours}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section Montants */}
                {(editing.remuneration_infi || editing.remuneration_med) && (
                  <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                    <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>💶 Montants</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {editing.remuneration_infi !== null && editing.remuneration_infi !== undefined && (
                        <div>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT INFIRMIER</div>
                          <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{editing.remuneration_infi} €</div>
                        </div>
                      )}
                      {editing.remuneration_med !== null && editing.remuneration_med !== undefined && (
                        <div>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT MÉDECIN</div>
                          <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{editing.remuneration_med} €</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section Commentaires */}
                {editing.comments && (
                  <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                    <div style={{fontWeight:700,marginBottom:8,fontSize:14,color:'#1f2937'}}>💬 Commentaires</div>
                    <div style={{whiteSpace:'pre-wrap',fontSize:14,color:'#374151',lineHeight:'1.5'}}>{editing.comments}</div>
                  </div>
                )}

                {/* Section Note de frais */}
                {(editing.expense_amount || editing.expense_comment || editing.proof_image) && (
                  <div style={{padding:12,border:'1px solid #f59e0b',borderRadius:8,background:'#fffbeb'}}>
                    <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#92400e'}}>🧾 Note de frais</div>
                    <div style={{display:'grid',gap:12}}>
                      {editing.expense_amount && (
                        <div>
                          <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>MONTANT</div>
                          <div style={{fontSize:15,fontWeight:600,color:'#d97706'}}>{editing.expense_amount} €</div>
                        </div>
                      )}
                      {editing.expense_comment && (
                        <div>
                          <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>COMMENTAIRE</div>
                          <div style={{fontSize:14,color:'#92400e'}}>{editing.expense_comment}</div>
                        </div>
                      )}
                      {editing.proof_image && (
                        <div>
                          <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>📸 JUSTIFICATIF</div>
                          <img src={editing.proof_image} alt="ticket" style={{maxWidth:'100%',maxHeight:250,border:'2px solid #fcd34d',borderRadius:6,display:'block'}} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // existing editable form for non-admin (same as before)
              <div className="edit-grid" style={{gridTemplateColumns:'1fr',gap:16}}>
                {/* Section Heures */}
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>📊 Heures de travail</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    { !editingIsGarde && (
                      <label style={{display:'flex',flexDirection:'column'}}>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES RÉELLES</div>
                        <input type="number" value={editing.hours_actual ?? ''} onChange={e=>setEditing({...editing, hours_actual: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                      </label>
                    ) }
                    {/* If prestation is a garde-type show garde-specific fields */}
                    { editingIsGarde ? (
                      <>
                        <label style={{display:'flex',flexDirection:'column'}}>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE</div>
                          <input type="number" value={editing.garde_hours ?? ''} onChange={e=>{ setEditing({...editing, garde_hours: e.target.value ? Number(e.target.value) : null}); }} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                          <div style={{fontSize:11,color:'#10b981',marginTop:6,fontWeight:600}}>💰 {ratePreview && ratePreview.rates && ratePreview.rates.detailed ? (ratePreview.rates.detailed.garde_infi ? ratePreview.rates.detailed.garde_infi+' €/h (infi) • '+ratePreview.rates.detailed.garde_med+' €/h (med)' : ratePreview.rates.infi+' €/h • '+ratePreview.rates.med+' €/h') : '—'}</div>
                        </label>
                        <label style={{display:'flex',flexDirection:'column'}}>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                          <input type="number" value={editing.sortie_hours ?? ''} onChange={e=>{ setEditing({...editing, sortie_hours: e.target.value ? Number(e.target.value) : null}); }} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                          <div style={{fontSize:11,color:'#10b981',marginTop:6,fontWeight:600}}>💰 {ratePreview && ratePreview.rates && ratePreview.rates.detailed ? (ratePreview.rates.detailed.sortie_infi ? ratePreview.rates.detailed.sortie_infi+' €/h (infi) • '+ratePreview.rates.detailed.sortie_med+' €/h (med)' : ratePreview.rates.infi+' €/h • '+ratePreview.rates.med+' €/h') : '—'}</div>
                        </label>
                      </>
                    ) : (
                      // If not garde and not permanence and not APS, allow optional garde_hours input
                      !editingIsPermanence && !editingIsAPS && (
                        <label style={{display:'flex',flexDirection:'column'}}>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE (si applicable)</div>
                          <input type="number" value={editing.garde_hours ?? ''} onChange={e=>setEditing({...editing, garde_hours: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                        </label>
                      )
                    )}
                    <label style={{display:'flex',flexDirection:'column'}}>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SUPPLÉMENTAIRES</div>
                      <input type="number" value={editing.overtime_hours ?? ''} onChange={e=>{ setEditing({...editing, overtime_hours: e.target.value ? Number(e.target.value) : null}); }} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                      <div style={{fontSize:11,color:'#10b981',marginTop:6,fontWeight:600}}>💰 {ratePreview && ratePreview.rates ? (ratePreview.rates.detailed && ratePreview.rates.detailed.sortie_med ? ratePreview.rates.detailed.sortie_med+' €/h (med) • '+ratePreview.rates.detailed.sortie_infi+' €/h (infi)' : ratePreview.rates.med+' €/h • '+ratePreview.rates.infi+' €/h') : '—'}</div>
                    </label>
                  </div>
                </div>

                {/* Section Montants */}
                { !editingIsPermanence && !editingIsGarde && !editingIsAPS && (
                  <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                    <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>💶 Montants</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <label style={{display:'flex',flexDirection:'column'}}>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT INFIRMIER</div>
                        <input type="number" step="0.01" value={editing.remuneration_infi ?? ''} onChange={e=>setEditing({...editing, remuneration_infi: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} placeholder="0.00" />
                      </label>
                      <label style={{display:'flex',flexDirection:'column'}}>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT MÉDECIN</div>
                        <input type="number" step="0.01" value={editing.remuneration_med ?? ''} onChange={e=>setEditing({...editing, remuneration_med: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} placeholder="0.00" />
                      </label>
                    </div>
                  </div>
                )}

                {/* Section Commentaires */}
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                  <label style={{display:'flex',flexDirection:'column'}}>
                    <div style={{fontWeight:700,marginBottom:8,fontSize:14,color:'#1f2937'}}>💬 Commentaires</div>
                    <textarea
                      value={editing.comments || ''}
                      onChange={e=>setEditing({...editing, comments: e.target.value})}
                      placeholder="Ajouter un commentaire sur cette prestation..."
                      style={{display:'block',width:'100%',minHeight:80,padding:10,border:'1px solid #d1d5db',borderRadius:6,resize:'vertical',fontFamily:'inherit',fontSize:14}}
                    />
                  </label>
                </div>

                {/* Section Note de frais */}
                <div style={{padding:12,border:'1px solid #f59e0b',borderRadius:8,background:'#fffbeb'}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#92400e'}}>🧾 Note de frais (si applicable)</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    <label style={{display:'flex',flexDirection:'column'}}>
                      <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>MONTANT</div>
                      <input type="number" step="0.01" value={editing.expense_amount ?? ''} onChange={e=>setEditing({...editing, expense_amount: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #fcd34d',fontSize:14}} placeholder="0.00" />
                    </label>
                  </div>
                  <label style={{display:'block',marginBottom:12}}>
                    <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>COMMENTAIRE</div>
                    <input value={editing.expense_comment || ''} onChange={e=>setEditing({...editing, expense_comment: e.target.value})} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #fcd34d',fontSize:14}} placeholder="Ex: Fournitures, transport..." />
                  </label>

                  <div style={{marginTop:8}}>
                    <div style={{fontWeight:600,marginBottom:6,fontSize:12,color:'#92400e'}}>📸 JUSTIFICATIF (IMAGE)</div>
                    <input type="file" accept="image/*" onChange={async (e)=>{
                      const f = e.target.files && e.target.files[0]
                      if (!f) return
                      const data = await new Promise((res, rej)=>{
                        const r = new FileReader()
                        r.onload = ()=>res(r.result)
                        r.onerror = rej
                        r.readAsDataURL(f)
                      })
                      setEditing({...editing, proof_image: data})
                    }} />

                    {editing.proof_image && (
                      <div style={{marginTop:8}}>
                        <img src={editing.proof_image} alt="ticket" style={{maxWidth:'100%',maxHeight:180,border:'2px solid #fcd34d',borderRadius:6,display:'block',marginBottom:8}} />
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>setEditing({...editing, proof_image: null})} style={{padding:'6px 12px',background:'#fee2e2',color:'#991b1b',borderRadius:6,border:'1px solid #fca5a5',cursor:'pointer',fontWeight:600,fontSize:13}}>🗑️ Supprimer l'image</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation preview modal (shown inside edit modal) */}
            {confirmOpen && confirmPreview && (
              <div style={{position:'relative',marginTop:12,padding:12,border:'1px solid #e6edf3',borderRadius:6,background:'#f9fafb'}}>
                <h4 style={{marginTop:0}}>Récapitulatif avant confirmation</h4>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div><strong>Heures réelles:</strong><div>{confirmPreview.hours_actual}</div></div>
                  <div><strong>Heures garde:</strong><div>{confirmPreview.garde_hours}</div></div>
                  <div><strong>Heures sortie:</strong><div>{confirmPreview.sortie_hours}</div></div>
                  <div><strong>Heures supp:</strong><div>{confirmPreview.overtime_hours}</div></div>
                  <div><strong>Note de frais (montant):</strong><div>{confirmPreview.expense_amount ? confirmPreview.expense_amount : 0}</div></div>
                  <div><strong>Total estimé:</strong><div style={{fontWeight:700}}>{confirmPreview.estimated_total} €</div></div>
                </div>
                {/* New detailed breakdown */}
                <div style={{marginTop:10,padding:10,border:'1px dashed #e2e8f0',borderRadius:6,background:'#fff'}}>
                  <div style={{fontWeight:700,marginBottom:8}}>Détail estimation</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    <div style={{minWidth:200}}><strong>Taux utilisés (estimation):</strong>
                      <div>Infirmier : {confirmPreview.rates ? confirmPreview.rates.infi : '—'} €/h</div>
                      <div>Médecin : {confirmPreview.rates ? confirmPreview.rates.med : '—'} €/h</div>
                      <div>Heures sup. x{confirmPreview.rates ? confirmPreview.rates.overtime_multiplier : '—'}</div>
                    </div>
                    <div style={{minWidth:200}}><strong>Montant estimé (infi):</strong>
                      <div style={{fontWeight:700}}>{confirmPreview.estimated_infi ?? 0} €</div>
                    </div>
                    <div style={{minWidth:200}}><strong>Montant estimé (med):</strong>
                      <div style={{fontWeight:700}}>{confirmPreview.estimated_med ?? 0} €</div>
                    </div>
                    <div style={{minWidth:200}}><strong>Dépenses:</strong>
                      <div style={{fontWeight:700}}>{confirmPreview.expense_amount ?? 0} €</div>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:10,color:'#6b7280',fontSize:13}}>Ce total est une estimation. Le montant final pourra être ajusté lors du traitement.</div>
              </div>
            )}

                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
              <button onClick={handleCloseModal} disabled={saving}>{role === 'admin' || editing.status === "En attente d'envoie" ? 'Fermer' : 'Annuler'}</button>
              {role !== 'admin' && editing.status !== "En attente d'envoie" && !confirmOpen && <button onClick={()=>saveEdit(false)} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>}
              {role !== 'admin' && confirmOpen && (
                <>
                  <button onClick={()=>{ setConfirmOpen(false); setConfirmPreview(null); }} disabled={saving}>Modifier</button>
                  <button onClick={confirmAndSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Confirmer'}</button>
                </>
              )}
              {role === 'admin' && <button onClick={saveEdit} disabled={saving || editing.status === "En attente d'envoie"}>{editing.status === "En attente d'envoie" ? 'Non modifiable' : (saving ? 'Enregistrement...' : 'Enregistrer')}</button>}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
