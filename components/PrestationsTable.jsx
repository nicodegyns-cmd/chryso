import React, { useEffect, useMemo, useState, useImperativeHandle, forwardRef, useRef, useCallback } from 'react'

const PrestationsTable = forwardRef(function PrestationsTable({ email }, ref) {
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

  // Ref to store openEdit function for imperative access
  const openEditRef = useRef(null)

  // Expose openEdit via imperative handle
  useImperativeHandle(ref, () => ({
    openEdit: (activity) => openEditRef.current?.(activity)
  }), [])

  // Handle closing the modal
  const handleCloseModal = () => {
    setEditing(null)
    setConfirmOpen(false)
    setConfirmPreview(null)
  }

  // Initialize date filters to show previous month, current month, and next month
  useEffect(() => {
    const today = new Date()
    
    // Get first day of previous month
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const dateFromValue = prevMonth.toISOString().split('T')[0]
    
    // Get last day of next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    const dateToValue = nextMonth.toISOString().split('T')[0]
    
    setDateFrom(dateFromValue)
    setDateTo(dateToValue)
  }, [])

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
  // Always use ANALYTIQUE if available (from eBrigade or local activity)
  // For eBrigade: use ebrigade_activity_type
  // For local: use analytic_name (ANALYTIQUE), fallback to pay_type (TYPE)
  const _editPayTypeLower = editing 
    ? String(
        editing.ebrigade_activity_type ||    // eBrigade prestation
        editing.analytic_name ||              // Local activity with analytic
        editing.pay_type ||                   // Fallback to type
        ''
      ).toLowerCase()
    : ''
  
  // Check if it's a Garde type that requires sortie_hours
  // Only "Garde NUIT", "Garde WEEK-END", or "Garde MEDECIN" trigger sortie_hours
  const editingIsGarde = editing
    ? (_editPayTypeLower.includes('garde') && (_editPayTypeLower.includes('nuit') || _editPayTypeLower.includes('week') || _editPayTypeLower.includes('medecin')))
    : false
  const editingIsPermanence = _editPayTypeLower.includes('permanence')
  const editingIsAPS = _editPayTypeLower.includes('aps')
  const editingIsRMP = _editPayTypeLower.includes('rmp')

  useEffect(() => {
    // Fetch both prestations and available activities
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // ADMIN: Load admin prestations only (no activities)
        if (clientRole === 'admin') {
          const r = await fetch('/api/admin/prestations')
          if (!r.ok) throw new Error('Échec de la récupération (admin)')
          const data = await r.json()
          setItems(data.items || [])
          return
        }
        
        // USER: Load user prestations + activities
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
    'À saisir',
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
      s === 'À saisir' ? '#9ca3af' :
      s === 'Annulé' ? '#ef4444' : '#6b7280'
    )
    return (
      <span style={{display:'inline-block',padding:'4px 8px',borderRadius:999,background:color+'22',color:color,fontWeight:600,fontSize:12}}>
        {label}
      </span>
    )
  }

  const today = new Date().toISOString().slice(0,10)

  // Build a set of keys for existing prestations, to hide duplicate activity cards.
  // Uses ebrigade_activity_code (E_CODE) as primary key — matches activity.analytic_code (also E_CODE).
  // Falls back to analytic_id with a distinct prefix to avoid cross-type collisions.
  const prestationKeys = useMemo(() => {
    const keys = new Set()
    items.forEach(p => {
      if (!p.isActivity && p.date) {
        if (p.ebrigade_activity_code) {
          keys.add(`${p.date}__ecode__${p.ebrigade_activity_code}`)
        }
        if (p.analytic_id) {
          keys.add(`${p.date}__anid__${p.analytic_id}`)
        }
      }
    })
    return keys
  }, [items])

  const filtered = items.filter((p) => {
    // Hide activity card when a prestation already exists for same date + activity.
    // activity.analytic_code = eBrigade E_CODE; prestation.ebrigade_activity_code = saved E_CODE.
    if (p.isActivity && p.date) {
      // Primary: match by E_CODE (most specific — avoids cross-activity collisions)
      if (p.analytic_code && prestationKeys.has(`${p.date}__ecode__${p.analytic_code}`)) return false
      // Fallback: match by analytic_id ONLY when activity has no E_CODE (rare unmapped case)
      if (!p.analytic_code && p.analytic_id && prestationKeys.has(`${p.date}__anid__${p.analytic_id}`)) return false
    }
    if (statusFilter && p.status !== statusFilter) return false
    // showUpcoming now filters to show only items that need hours to be declared (not filled)
    if (showUpcoming){ if (isFilled(p)) return false }
    if (dateFrom){ if (!p.date || p.date < dateFrom) return false }
    if (dateTo){ if (!p.date || p.date > dateTo) return false }
    return true
  })

  async function openEdit(p){
    console.log('[openEdit] called with:', p, 'items count:', items.length)
    
    // If this is an activity (not a prestation), look for existing prestation or create new one
    if (p.isActivity) {
      console.log('[openEdit] ACTIVITY DETECTED: date=' + p.date + ', analytic_code=' + p.analytic_code)
      
      // FIRST: Check in the API if a prestation already exists for this user/date/analytic
      // This ensures we don't miss existing prestations that are scrolled out of view or filtered
      try {
        const checkResp = await fetch(
          `/api/admin/prestations?user_email=${encodeURIComponent(email)}&date=${p.date}&analytic_code=${encodeURIComponent(p.analytic_code || '')}`,
          { method: 'GET' }
        )
        if (checkResp.ok) {
          const checkData = await checkResp.json()
          console.log('[openEdit] API check result:', checkData)
          
          // Look for non-finalized prestation matching this specific activity.
          // Primary: match by E_CODE (ebrigade_activity_code). Fallback: analytic_id only
          // if prestation has no E_CODE (legacy records), to avoid cross-activity matches.
          const existingFromApi = checkData.prestations?.find(prest => {
            if (prest.status === 'Envoyé à la facturation') return false
            if (prest.ebrigade_activity_code && p.analytic_code)
              return prest.ebrigade_activity_code === p.analytic_code
            if (!prest.ebrigade_activity_code && prest.analytic_id && p.analytic_id)
              return prest.analytic_id === p.analytic_id
            return false
          })
          
          if (existingFromApi && existingFromApi.id) {
            console.log('[openEdit] ✅ FOUND existing prestation in API (id=' + existingFromApi.id + ')')
            // Fetch full details of this prestation
            const fullResp = await fetch(`/api/prestations/${existingFromApi.id}`)
            if (fullResp.ok) {
              const fullData = await fullResp.json()
              setEditing({
                ...fullData,
                isActivity: true,
                isEBrigade: true
              })
              return
            }
          }
        }
      } catch (apiErr) {
        console.warn('[openEdit] Could not check API:', apiErr)
        // Fall back to local search
      }
      
      // FALLBACK: Look for existing prestation in items (visible ones).
      // Primary match: by E_CODE. Fallback: by analytic_id ONLY if prestation has no E_CODE,
      // to avoid cross-activity pre-filling when two activities share the same analytic_id.
      let existingPrestation = items.find(prest => {
        if (prest.isActivity || prest.id?.toString().startsWith('act_')) return false
        if (prest.date !== p.date) return false
        if (prest.status === 'Envoyé à la facturation') return false
        if (prest.ebrigade_activity_code && p.analytic_code)
          return prest.ebrigade_activity_code === p.analytic_code
        if (!prest.ebrigade_activity_code && prest.analytic_id && p.analytic_id)
          return prest.analytic_id === p.analytic_id
        return false
      })
      
      if (existingPrestation && existingPrestation.id) {
        console.log('[openEdit] ✅ FOUND existing prestation in items (id=' + existingPrestation.id + ')')
        setEditing({
          ...existingPrestation,
          isActivity: true,
          isEBrigade: true
        })
        return
      } else {
        console.log('[openEdit] ❌ NO existing prestation found, creating new')
      }
      
      // No existing prestation found, create new one from activity
      const editingState = {
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
        // eBrigade data for Garde/activity hours
        ebrigade_duration_hours: p.duration || null,
        ebrigade_start_time: p.startTime || null,
        ebrigade_end_time: p.endTime || null,
        // eBrigade prestation metadata
        ebrigade_activity_code: p.ebrigade_activity_code || p.analytic_code || p.activityCode || null,
        ebrigade_id: p.ebrigade_id || null,
        ebrigade_activity_name: p.ebrigade_activity_name || null,
        ebrigade_activity_type: p.ebrigade_activity_type || null,
        ebrigade_personnel_id: p.ebrigade_personnel_id || null,
        ebrigade_personnel_name: p.ebrigade_personnel_name || null,
        status: 'À saisir',
        user_email: email,
        expense_amount: null,
        expense_comment: null,
        comments: null,
        proof_image: null,
        isActivity: true, // Flag to force editable form for activities
        // mark as eBrigade if the incoming activity originates from eBrigade
        isEBrigade: !!(p.source === 'ebrigade' || p.activityCode || p.E_CODE || p.ebrigade_activity_code || p.ebrigade_id)
      }
      setEditing(editingState)
      return
    }
    
    console.log('[openEdit] NOT an activity, treating as prestation edit')

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
    setEditing({
      ...p,
      // ensure isEBrigade is preserved/detected when editing an object that carries eBrigade metadata
      isEBrigade: !!(p.isEBrigade || p.source === 'ebrigade' || p.activityCode || p.E_CODE || p.ebrigade_activity_code || p.ebrigade_id)
    })
  }
  
  // Update ref for imperative access to openEdit
  openEditRef.current = openEdit

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

    // Prevent saving if status is locked (submitted or approved)
    const lockedStatuses = ["En attente d'envoie", "En attente d'approbation", 'Envoyé à la facturation']
    if (lockedStatuses.includes(editing.status)) {
      alert('Cette prestation ne peut plus être modifiée.')
      return
    }
    
    // For new prestations from activities, immediately update status to "En attente d'approbation"
    if (isNewPrestation && editing.isActivity && (!role || (role !== 'admin' && role !== 'moderator'))) {
      setEditing({...editing, status: "En attente d'approbation"})
    }

    // Non-admin users require confirmation modal before actual save
    if (!confirmed && role !== 'admin'){
      // prepare preview: list hours and an estimated total
      const payLowerForPreview = (editing.pay_type || '').toLowerCase()
      let gardeHoursForPreview = editing.garde_hours || 0
      let sortieHoursForPreview = editing.sortie_hours || 0
      
      // Distribute hours_actual to garde_hours or sortie_hours based on pay_type
      const hoursToDistribute = editing.hours_actual || 0
      if (hoursToDistribute > 0) {
        if (payLowerForPreview.includes('garde')) {
          gardeHoursForPreview = hoursToDistribute
        } else if (payLowerForPreview.includes('sortie') || payLowerForPreview.includes('perm') || payLowerForPreview.includes('astreinte')) {
          sortieHoursForPreview = hoursToDistribute
        }
      }
      
      // For Garde activities: auto-calculate garde_hours from total duration - sortie_hours
      if (payLowerForPreview.includes('garde') && editing.ebrigade_duration_hours && editing.sortie_hours !== null && editing.sortie_hours !== undefined) {
        gardeHoursForPreview = editing.ebrigade_duration_hours - editing.sortie_hours
      }
      
      const preview = {
        hours_actual: editing.hours_actual || 0,
        garde_hours: gardeHoursForPreview,
        sortie_hours: sortieHoursForPreview,
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
        const estimatePayload = {
          garde_hours: preview.garde_hours,
          sortie_hours: preview.sortie_hours,
          overtime_hours: preview.overtime_hours,
          hours_actual: preview.hours_actual,
          pay_type: editing.pay_type,
          analytic_id: editing.analytic_id || null,
          analytic_code: editing.analytic_code || null,
          analytic_name: editing.analytic_name || null,
          ebrigade_activity_code: editing.ebrigade_activity_code || editing.activityCode || null,
          ebrigade_activity_name: editing.ebrigade_activity_name || null,
          // Do not send the literal 'user' role — let server resolve by email when role is non-canonical
          user_role: (clientRole && clientRole !== 'user') ? clientRole : (editing.user_role || null),
          user_email: (typeof window !== 'undefined' ? localStorage.getItem('email') : null) || editing.user_email || editing.email || null,
          expense_amount: preview.expense_amount || 0
        }
        console.log('ESTIMATE PAYLOAD SENT:', estimatePayload)
        const resp = await fetch('/api/prestations/estimate', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(estimatePayload)
        })
        if (resp.ok){
          const data = await resp.json()
          preview.estimated_infi = data.estimated_infi
          preview.estimated_med = data.estimated_med
          preview.rates = data.rates
          
          // Calculate detailed breakdown by garde vs sortie
          const rateData = data.rates.detailed || {}
          preview.garde_amount_infi = Math.round(((Number(preview.garde_hours || 0) * Number(rateData.garde_infi || 0)) + Number.EPSILON) * 100) / 100
          preview.garde_amount_med = Math.round(((Number(preview.garde_hours || 0) * Number(rateData.garde_med || 0)) + Number.EPSILON) * 100) / 100
          preview.sortie_amount_infi = Math.round(((Number(preview.sortie_hours || 0) * Number(rateData.sortie_infi || 0)) + Number.EPSILON) * 100) / 100
          preview.sortie_amount_med = Math.round(((Number(preview.sortie_hours || 0) * Number(rateData.sortie_med || 0)) + Number.EPSILON) * 100) / 100
          const otAmount = Math.round(((Number(preview.overtime_hours || 0) * Number(rateData.garde_infi || 0) * 1.5) + Number.EPSILON) * 100) / 100
          preview.overtime_amount_infi = otAmount
          preview.overtime_amount_med = Math.round(((Number(preview.overtime_hours || 0) * Number(rateData.garde_med || 0) * 1.5) + Number.EPSILON) * 100) / 100
          
          // Update editing with estimated totals (for display in Montants section)
          setEditing({...editing, remuneration_infi: data.estimated_infi, remuneration_med: data.estimated_med})
          
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
      const payLower = (editing.pay_type || '').toLowerCase()
      let estInfi = 0
      let estMed = 0
      if (payLower.includes('garde')) {
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
      
      // Ensure user_email is always set for API calls
      if (!effective.user_email) {
        effective.user_email = email || (typeof window !== 'undefined' ? localStorage.getItem('email') : null)
      }

      // When we have separate garde/sortie hours with detailed rates, save TOTALS not hourly rates
      if (confirmPreview && confirmPreview.estimated_infi !== undefined) {
        // Save the TOTAL calculated amount
        effective.remuneration_infi = confirmPreview.estimated_infi
        effective.remuneration_med = confirmPreview.estimated_med || 0
        
        // Also save sortie rates if available (for PDF to use later)
        effective.remuneration_sortie_infi = confirmPreview.rates?.detailed?.sortie_infi || null
        effective.remuneration_sortie_med = confirmPreview.rates?.detailed?.sortie_med || null
      } else if (confirmPreview) {
        // Fallback if no detailed rates: use provided estimates
        if (confirmPreview.estimated_infi !== undefined && confirmPreview.estimated_infi !== null) {
          effective.remuneration_infi = confirmPreview.estimated_infi
        }
        if (confirmPreview.estimated_med !== undefined && confirmPreview.estimated_med !== null) {
          effective.remuneration_med = confirmPreview.estimated_med
        }
      }

      console.log('[saveEdit] About to save:', {
        isNewPrestation,
        analytic_id: effective.analytic_id,
        analytic_code: effective.analytic_code,
        analytic_name: effective.analytic_name,
        date: effective.date,
        pay_type: effective.pay_type,
        user_email: effective.user_email,
        remuneration_infi: effective.remuneration_infi,
        remuneration_med: effective.remuneration_med
      })
      
      // Always set status to "En attente d'approbation" for non-admin/moderator users
      if (!role || (role !== 'admin' && role !== 'moderator')){
        effective.status = "En attente d'approbation"
      }
      const payLower = (effective.pay_type || '').toLowerCase()
      if (payLower.includes('permanence')){
        delete effective.remuneration_infi
        delete effective.remuneration_med
      }
      
      // For Garde activities: auto-calculate garde_hours from total duration - sortie_hours
      if (payLower.includes('garde') && effective.ebrigade_duration_hours && effective.sortie_hours !== null && effective.sortie_hours !== undefined) {
        effective.garde_hours = effective.ebrigade_duration_hours - effective.sortie_hours
      }

      // Ensure eBrigade data is included in the save
      // This preserves ANALYTIQUE and other eBrigade info
      if (editing.isEBrigade) {
        // Prefer explicit ebrigade_id, otherwise fall back to activity code or other known keys
        effective.ebrigade_id = editing.ebrigade_id || editing.ebrigade_activity_code || editing.activityCode || null
        effective.ebrigade_personnel_id = editing.ebrigade_personnel_id || null
        effective.ebrigade_personnel_name = editing.ebrigade_personnel_name || null
        // Keep both fields in sync when possible
        effective.ebrigade_activity_code = editing.ebrigade_activity_code || editing.activityCode || null
        effective.ebrigade_activity_name = editing.ebrigade_activity_name || editing.activity || null
        effective.ebrigade_activity_type = editing.ebrigade_activity_type || editing.activityType || null
        effective.ebrigade_duration_hours = editing.ebrigade_duration_hours || null
        effective.ebrigade_start_time = editing.ebrigade_start_time || null
        effective.ebrigade_end_time = editing.ebrigade_end_time || null
      }

      // Handle new prestation (POST) vs updating existing one (PATCH)
      let r
      // Always use admin endpoint for saving prestations
      if (isNewPrestation) {
        // Create new prestation
        r = await fetch('/api/admin/prestations', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(effective)
        })
      } else {
        // Update existing prestation (skip if ID is an activity ID like "act_...")
        if (effective.id && effective.id.toString().startsWith('act_')) {
          // This is an activity - convert to POST for new prestation
          r = await fetch('/api/admin/prestations', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({...effective, id: null})
          })
        } else {
          // Normal PATCH update
          r = await fetch(`/api/admin/prestations/${effective.id}`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(effective)
          })
        }
      }
      
      if (!r.ok) {
        try {
          const errData = await r.json()
          console.error('[saveEdit] API error response:', errData)
          throw new Error(`Erreur ${r.status}: ${errData.error || 'Échec enregistrement'}`)
        } catch(parseErr) {
          console.error('[saveEdit] Could not parse error response:', parseErr)
          throw new Error(`Erreur ${r.status}: Échec enregistrement`)
        }
      }
      const updated = await r.json()
      console.log('[saveEdit] Success! Updated:', updated.id)
      
      // Reload page immediately to sync everything
      console.log('[saveEdit] Reloading page now...')
      window.location.reload()
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
        // For Garde type: auto-calc garde_hours = ebrigade_duration - sortie_hours
        let liveGardeH = editing.garde_hours || 0
        if (editingIsGarde && editing.ebrigade_duration_hours != null &&
            editing.sortie_hours !== null && editing.sortie_hours !== undefined) {
          liveGardeH = editing.ebrigade_duration_hours - editing.sortie_hours
        }
        const body = {
          garde_hours: liveGardeH,
          sortie_hours: editing.sortie_hours || 0,
          overtime_hours: editing.overtime_hours || 0,
          hours_actual: editing.hours_actual || 0,
          pay_type: editing.pay_type || '',
          analytic_id: editing.analytic_id || null,
          analytic_name: editing.analytic_name || null,
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
  }, [editing && editing.garde_hours, editing && editing.sortie_hours, editing && editing.overtime_hours, editing && editing.hours_actual, editing && editing.pay_type, editing && editing.analytic_id, editing && editing.analytic_name, editing && editing.ebrigade_duration_hours, clientRole])

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
                  const ref = '#' + (editing.request_ref || editing.invoice_number || editing.id)
                  if (role === 'admin') return `📋 Détails demande ${ref}`
                  if (editing.status === "En attente d'envoie" || editing.status === "En attente d'approbation" || editing.status === 'Envoyé à la facturation') return `👁️ Consulter prestation ${ref}`
                  return `✏️ Modifier prestation ${ref}`
                })()
              }</h3>
            </div>

            <div style={{padding:24}}>

            {(editing.status === "En attente d'envoie" || editing.status === "En attente d'approbation" || editing.status === 'Envoyé à la facturation') && role !== 'admin' && (
              <div style={{padding:12,background: editing.status === 'Envoyé à la facturation' ? '#dcfce7' : editing.status === "En attente d'approbation" ? '#ede9fe' : '#fef3c7',border:`1px solid ${editing.status === 'Envoyé à la facturation' ? '#86efac' : editing.status === "En attente d'approbation" ? '#c4b5fd' : '#fcd34d'}`,borderRadius:6,marginBottom:12,color: editing.status === 'Envoyé à la facturation' ? '#166534' : editing.status === "En attente d'approbation" ? '#5b21b6' : '#92400e',fontSize:13}}>
                <strong>{editing.status === 'Envoyé à la facturation' ? '✅ Cette prestation a été envoyée à la facturation' : editing.status === "En attente d'approbation" ? "🔒 Cette prestation est en attente d'approbation" : "🔒 Cette demande est en attente d'envoie"}</strong> — Vous pouvez consulter les informations mais vous ne pouvez plus les modifier.
              </div>
            )}

            {role === 'admin' && !editing.isActivity || editing.status === "En attente d'envoie" || editing.status === "En attente d'approbation" || editing.status === 'Envoyé à la facturation' ? (
              // Admin read-only view OR blocked prestation: show submitted values with styled sections
              <div className="edit-grid" style={{gridTemplateColumns:'1fr',gap:16}}>
                {console.log('[PrestationsTable] Rendering ADMIN/READ-ONLY view. role:', role, 'isActivity:', editing.isActivity)}
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
                  </div>
                </div>

                {/* Section Montants - affiche seulement le montant du rôle de l'utilisateur */}
                {(confirmPreview?.estimated_infi || confirmPreview?.estimated_med || editing.remuneration_infi || editing.remuneration_med) && !_editPayTypeLower.includes('rmp') && (
                  <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                    <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>💶 Montants</div>
                    {(() => {
                      const roleLower = (clientRole || role || (typeof window !== 'undefined' ? localStorage.getItem('role') : null) || '').toLowerCase()
                      const isMed = roleLower.includes('med') || roleLower.includes('médec') || roleLower.includes('doctor') || roleLower.includes('doc')
                      const isInfi = roleLower.includes('infi') || roleLower.includes('infir') || roleLower.includes('infirm') || roleLower.includes('nurs')
                      // If role is unknown show both; admin always sees both (handled by parent condition)
                      const showInfi = isInfi || (!isInfi && !isMed)
                      const showMed  = isMed  || (!isInfi && !isMed)
                      const infiVal = confirmPreview?.estimated_infi ?? editing.remuneration_infi
                      const medVal  = confirmPreview?.estimated_med  ?? editing.remuneration_med
                      return (
                        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
                          {showInfi && infiVal != null && (
                            <div>
                              <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT INFIRMIER</div>
                              <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{infiVal} €</div>
                            </div>
                          )}
                          {showMed && medVal != null && (
                            <div>
                              <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT MÉDECIN</div>
                              <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{medVal} €</div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
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
              // existing editable form for non-admin and activities
              <div className="edit-grid" style={{gridTemplateColumns:'1fr',gap:16}}>
                {console.log('[PrestationsTable] Rendering EDITABLE view. role:', role, 'isActivity:', editing.isActivity)}
                {/* Section Heures */}
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb'}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>📊 Heures de travail</div>
                  
                  {/* For Garde activities: show eBrigade calculated hours and user inputs */}
                  {editingIsGarde && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {/* Read-only: Total hours from eBrigade */}
                      {editing.ebrigade_duration_hours && (
                        <div style={{padding:10,background:'#eff6ff',borderRadius:6,border:'1px solid #bfdbfe'}}>
                          <div style={{fontSize:12,color:'#0366d6',fontWeight:600,marginBottom:6}}>📅 HEURES TOTALES (eBrigade)</div>
                          <div style={{fontSize:16,fontWeight:700,color:'#0366d6'}}>{editing.ebrigade_duration_hours}h</div>
                          <div style={{fontSize:11,color:'#0366d6',marginTop:4}}>Calculé depuis {editing.ebrigade_start_time || '—'} à {editing.ebrigade_end_time || '—'}</div>
                        </div>
                      )}
                      
                      {/* User inputs */}
                      <label style={{display:'flex',flexDirection:'column'}}>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                        <input type="number" value={editing.sortie_hours ?? ''} onChange={e=>{ setEditing({...editing, sortie_hours: e.target.value ? Number(e.target.value) : null}); }} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                        <div style={{fontSize:11,color:'#10b981',marginTop:6,fontWeight:600}}>💰 {ratePreview && ratePreview.rates && ratePreview.rates.detailed ? (ratePreview.rates.detailed.sortie_infi ? ratePreview.rates.detailed.sortie_infi+' €/h (infi) • '+ratePreview.rates.detailed.sortie_med+' €/h (med)' : ratePreview.rates.infi+' €/h • '+ratePreview.rates.med+' €/h') : '—'}</div>
                      </label>
                      
                      {/* Auto-calculated garde hours - shows even when sortie_hours=0 */}
                      {editing.ebrigade_duration_hours && editing.sortie_hours !== null && editing.sortie_hours !== undefined && (
                        <div style={{padding:10,background:'#f0fdf4',borderRadius:6,border:'1px solid #bbf7d0'}}>
                          <div style={{fontSize:12,color:'#15803d',fontWeight:600,marginBottom:6}}>🧮 HEURES GARDE (Calculées)</div>
                          <div style={{fontSize:16,fontWeight:700,color:'#15803d'}}>{(editing.ebrigade_duration_hours - (editing.sortie_hours || 0)).toFixed(2)}h</div>
                          <div style={{fontSize:11,color:'#15803d',marginTop:4}}>= {editing.ebrigade_duration_hours}h (total) − {editing.sortie_hours}h (sortie)</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* For other activity types */}
                  {!editingIsGarde && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <label style={{display:'flex',flexDirection:'column'}}>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES RÉELLES</div>
                        <input type="number" value={editing.hours_actual ?? ''} onChange={e=>setEditing({...editing, hours_actual: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                      </label>
                      {/* If not garde and not permanence and not APS, allow optional garde_hours input */}
                      {!editingIsPermanence && !editingIsAPS && (
                        <label style={{display:'flex',flexDirection:'column'}}>
                          <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE (si applicable)</div>
                          <input type="number" value={editing.garde_hours ?? ''} onChange={e=>setEditing({...editing, garde_hours: e.target.value ? Number(e.target.value) : null})} style={{padding:'8px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}} />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Section Montants */}
                { !editingIsPermanence && !editingIsGarde && !editingIsAPS && !editingIsRMP && (
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
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
                    {/* Show detailed breakdown if we have it */}
                    {confirmPreview.garde_amount_infi !== undefined && (
                      <div style={{flex:1,minWidth:250,padding:10,background:'#f0f9ff',borderRadius:6,borderLeft:'3px solid #3b82f6'}}>
                        <strong style={{display:'block',marginBottom:8}}>Décomposition:</strong>
                        <div style={{fontSize:13}}>
                          {confirmPreview.garde_hours > 0 && <div>Garde: {confirmPreview.garde_hours}h × {confirmPreview.rates?.detailed?.garde_infi || 0}€ = <strong>{confirmPreview.garde_amount_infi || 0}€</strong></div>}
                          {confirmPreview.sortie_hours > 0 && <div>Sortie: {confirmPreview.sortie_hours}h × {confirmPreview.rates?.detailed?.sortie_infi || 0}€ = <strong>{confirmPreview.sortie_amount_infi || 0}€</strong></div>}
                          {confirmPreview.overtime_hours > 0 && <div>Supp: {confirmPreview.overtime_hours}h × {confirmPreview.rates?.detailed?.garde_infi || 0}€ × 1.5 = <strong>{confirmPreview.overtime_amount_infi || 0}€</strong></div>}
                          <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #bfdbfe',fontWeight:700}}>Total: {confirmPreview.estimated_infi}€</div>
                        </div>
                      </div>
                    )}
                    
                    {!confirmPreview.garde_amount_infi && confirmPreview.estimated_med > 0 && (
                      <div style={{flex:1,minWidth:250,padding:10,background:'#fef3c7',borderRadius:6,borderLeft:'3px solid #f59e0b'}}>
                        <strong style={{display:'block',marginBottom:8}}>Décomposition Médecin:</strong>
                        <div style={{fontSize:13}}>
                          {confirmPreview.garde_hours > 0 && <div>Garde: {confirmPreview.garde_hours}h × {confirmPreview.rates?.detailed?.garde_med || 0}€ = <strong>{confirmPreview.garde_amount_med || 0}€</strong></div>}
                          {confirmPreview.sortie_hours > 0 && <div>Sortie: {confirmPreview.sortie_hours}h × {confirmPreview.rates?.detailed?.sortie_med || 0}€ = <strong>{confirmPreview.sortie_amount_med || 0}€</strong></div>}
                          {confirmPreview.overtime_hours > 0 && <div>Supp: {confirmPreview.overtime_hours}h × {confirmPreview.rates?.detailed?.garde_med || 0}€ × 1.5 = <strong>{confirmPreview.overtime_amount_med || 0}€</strong></div>}
                          <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #fde68a',fontWeight:700}}>Total: {confirmPreview.estimated_med}€</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Fallback to simple display if no detailed breakdown */}
                    {confirmPreview.garde_amount_infi === undefined && (
                      <>
                        <div style={{flex:1,minWidth:200}}><strong>Montant estimé (infi):</strong>
                          <div style={{fontWeight:700,marginTop:4}}>{confirmPreview.estimated_infi ?? 0} €</div>
                        </div>
                        {confirmPreview.estimated_med > 0 && <div style={{flex:1,minWidth:200}}><strong>Montant estimé (med):</strong>
                          <div style={{fontWeight:700,marginTop:4}}>{confirmPreview.estimated_med ?? 0} €</div>
                        </div>}
                      </>
                    )}
                    
                    <div style={{flex:1,minWidth:200}}><strong>Dépenses:</strong>
                      <div style={{fontWeight:700,marginTop:4}}>{confirmPreview.expense_amount ?? 0} €</div>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:10,color:'#6b7280',fontSize:13}}>Ce total est une estimation. Le montant final pourra être ajusté lors du traitement.</div>
              </div>
            )}

                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
              {(() => {
                const locked = ["En attente d'envoie", "En attente d'approbation", 'Envoyé à la facturation'].includes(editing.status)
                return (
                  <>
                    <button onClick={handleCloseModal} disabled={saving}>{role === 'admin' || locked ? 'Fermer' : 'Annuler'}</button>
                    {role !== 'admin' && !locked && !confirmOpen && <button onClick={()=>saveEdit(false)} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>}
                    {role !== 'admin' && !locked && confirmOpen && (
                      <>
                        <button onClick={()=>{ setConfirmOpen(false); setConfirmPreview(null); }} disabled={saving}>Modifier</button>
                        <button onClick={confirmAndSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Confirmer'}</button>
                      </>
                    )}
                    {role === 'admin' && <button onClick={saveEdit} disabled={saving || locked}>{locked ? 'Non modifiable' : (saving ? 'Enregistrement...' : 'Enregistrer')}</button>}
                  </>
                )
              })()}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default PrestationsTable
