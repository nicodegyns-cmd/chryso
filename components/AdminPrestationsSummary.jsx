import React, { useEffect, useState, useMemo } from 'react'

export default function AdminPrestationsSummary({ limit = 8 }){
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

  // Load activity rates when viewing a prestation
  useEffect(() => {
    if (viewing && !activityRates[viewing.id]) {
      loadActivityRates(viewing)
    }
  }, [viewing, activityRates])

  useEffect(()=>{ fetchItems() }, [])

  async function loadActivityRates(p) {
    try {
      const r = await fetch('/api/prestations/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours_actual: p.hours_actual || 0,
          garde_hours: p.garde_hours || 0,
          sortie_hours: p.sortie_hours || 0,
          overtime_hours: p.overtime_hours || 0,
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
            const r = await fetch('/api/prestations/estimate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hours_actual: p.hours_actual || 0,
                garde_hours: p.garde_hours || 0,
                sortie_hours: p.sortie_hours || 0,
                overtime_hours: p.overtime_hours || 0,
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
      const r = await fetch(`/api/admin/prestations/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status }) })
      if (!r.ok) throw new Error('update failed')
      const updated = await r.json()
      setItems(prev => prev.map(p => p.id === updated.id ? updated : p))
      // Show success notification
      if (status === "En attente d'envoie") {
        alert(`✅ Prestaton validée!\nFacture générée: ${updated.invoice_number || 'N/A'}\nL'utilisateur peut télécharger sa facture.`)
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

  const filtered = useMemo(() => {
    return items.filter(it => {
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
      </div>
      {loading ? <div className="small-muted">Chargement...</div> : (
        <table style={{width:'100%',borderCollapse:'collapse',borderRadius:8,overflow:'hidden'}}>
          <thead>
            <tr style={{background:'#f3f4f6',borderBottom:'2px solid #e5e7eb'}}>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>ID</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Utilisateur</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Date</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Type</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Montant</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Statut</th>
              <th style={{textAlign:'left',padding:12,fontWeight:700,color:'#1f2937',fontSize:14}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && <tr><td colSpan={7} style={{padding:12,color:'#666',textAlign:'center',background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>Aucune demande</td></tr>}
            {displayed.map((it, idx) => (
              <tr key={it.id} style={{
                background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                borderBottom:'1px solid #e5e7eb',
                transition:'background-color 0.2s',
              }}
              onMouseEnter={(e)=>e.currentTarget.style.background='#eff6ff'}
              onMouseLeave={(e)=>e.currentTarget.style.background=(idx % 2 === 0 ? '#fff' : '#f9fafb')}
              >
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}><strong>{it.analytic_code || it.request_ref || it.invoice_number || `#${it.id}`}</strong></td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>
                  <div style={{fontWeight:500}}>{it.user_firstname && it.user_lastname ? `${it.user_firstname} ${it.user_lastname}` : (it.user_email || '-')}</div>
                </td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>{formatDate(it.date)}</td>
                <td style={{padding:12,fontSize:14,color:'#1f2937'}}>{it.pay_type || '-'}</td>
                <td style={{padding:12,fontSize:14,fontWeight:600,color:'#10b981'}}>
                  {(it.remuneration_infi != null || it.remuneration_med != null) ? `${it.remuneration_infi ? it.remuneration_infi + '€' : ''}${it.remuneration_infi && it.remuneration_med ? ' + ' : ''}${it.remuneration_med ? it.remuneration_med + '€' : ''}` : estimatedAmounts[it.id] ? estimatedAmounts[it.id] + ' €' : '-'}
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
                <td style={{padding:12,fontSize:14}}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button disabled={!!savingIds[it.id]} onClick={()=>setViewing(it)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:'#e0e7ff',color:'#3730a3',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}>👁️ Voir</button>
                    {it.pdf_url && <a href={it.pdf_url.replace(/^\/exports\//, '/api/exports/download?file=')} download style={{padding:'6px 12px',borderRadius:6,border:'1px solid #c7d2fe',background:'#e0e7ff',color:'#3730a3',cursor:'pointer',fontWeight:600,fontSize:13,textDecoration:'none',display:'inline-block',transition:'all 0.2s'}}>📄 Facture</a>}
                    <button disabled={!!savingIds[it.id]} onClick={()=>updateStatus(it.id, "En attente d'envoie")} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #fcd34d',background:'#fef3c7',color:'#92400e',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}>✓ Valider</button>
                    <button disabled={!!savingIds[it.id]} onClick={()=>setRefusingId(it.id)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #fca5a5',background:'#fee2e2',color:'#991b1b',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all 0.2s'}}>✕ Refuser</button>
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
      {viewing && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <div style={{width:'100%',maxWidth:800,background:'#fff',borderRadius:12,boxShadow:'0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',overflow:'auto',maxHeight:'90vh'}}>
            <div style={{padding:24,borderBottom:'1px solid #e5e7eb'}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#1f2937'}}>
                📋 {viewing.ebrigade_activity_name || viewing.analytic_name ? `${viewing.ebrigade_activity_name || viewing.analytic_name} - ` : ''}Détails demande {viewing.analytic_code || viewing.request_ref || viewing.invoice_number || `#${viewing.id}`}
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
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{viewing.hours_actual}</div>
                    </div>
                  )}
                  {viewing.pay_type !== 'APS' && viewing.garde_hours !== null && viewing.garde_hours !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES GARDE</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{viewing.garde_hours}</div>
                    </div>
                  )}
                  {viewing.sortie_hours !== null && viewing.sortie_hours !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SORTIE</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{viewing.sortie_hours}</div>
                    </div>
                  )}
                  {viewing.overtime_hours !== null && viewing.overtime_hours !== undefined && (
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>HEURES SUPPLÉMENTAIRES</div>
                      <div style={{fontSize:15,color:'#1f2937',fontWeight:500}}>{viewing.overtime_hours}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Montants */}
              {viewing.pay_type !== 'APS' && (viewing.remuneration_infi || viewing.remuneration_med) && (
                <div style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb',marginBottom:16}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#1f2937'}}>💶 Montants</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    {viewing.remuneration_infi !== null && viewing.remuneration_infi !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT INFIRMIER</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{viewing.remuneration_infi} €</div>
                      </div>
                    )}
                    {viewing.remuneration_med !== null && viewing.remuneration_med !== undefined && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:6}}>MONTANT MÉDECIN</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#10b981'}}>{viewing.remuneration_med} €</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Detailed breakdown by garde/sortie if available */}
                  {(viewing.garde_hours || viewing.sortie_hours) && (
                    <div style={{fontSize:12,color:'#6b7280',padding:8,background:'#fff',borderRadius:6,border:'1px dashed #d1d5db'}}>
                      <div style={{fontWeight:600,marginBottom:6,color:'#374151'}}>Décomposition:</div>
                      {viewing.garde_hours > 0 && <div>• Garde: {viewing.garde_hours}h</div>}
                      {viewing.sortie_hours > 0 && <div>• Sortie: {viewing.sortie_hours}h</div>}
                      {viewing.overtime_hours > 0 && <div>• Supplémentaires: {viewing.overtime_hours}h (x1.5)</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Section Tarifs de l'activité locale */}
              {activityRates[viewing.id] && (
                <div style={{padding:12,border:'1px solid #d97706',borderRadius:8,background:'#fffbeb',marginBottom:16}}>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14,color:'#92400e'}}>📍 Tarifs de l'activité locale</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    {activityRates[viewing.id].detailed?.garde_infi != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>GARDE - INFIRMIER</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{activityRates[viewing.id].detailed.garde_infi} €/h</div>
                      </div>
                    )}
                    {activityRates[viewing.id].detailed?.garde_med != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>GARDE - MÉDECIN</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{activityRates[viewing.id].detailed.garde_med} €/h</div>
                      </div>
                    )}
                    {activityRates[viewing.id].detailed?.sortie_infi != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>SORTIE - INFIRMIER</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{activityRates[viewing.id].detailed.sortie_infi} €/h</div>
                      </div>
                    )}
                    {activityRates[viewing.id].detailed?.sortie_med != null && (
                      <div>
                        <div style={{fontSize:12,color:'#92400e',fontWeight:600,marginBottom:6}}>SORTIE - MÉDECIN</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#d97706'}}>{activityRates[viewing.id].detailed.sortie_med} €/h</div>
                      </div>
                    )}
                  </div>

                  {/* Detailed calculation breakdown */}
                  {(viewing.garde_hours || viewing.sortie_hours) && (
                    <div style={{fontSize:11,color:'#92400e',padding:10,background:'#fff',borderRadius:6,border:'1px solid #fcd34d',fontFamily:'monospace',lineHeight:'1.6'}}>
                      <div style={{fontWeight:700,marginBottom:8,color:'#b45309'}}>Calcul détaillé:</div>
                      {viewing.garde_hours > 0 && activityRates[viewing.id].detailed?.garde_infi && (
                        <div>
                          <div>Infirmier: ({viewing.garde_hours}h × {activityRates[viewing.id].detailed.garde_infi}€) + ({viewing.sortie_hours || 0}h × {activityRates[viewing.id].detailed?.sortie_infi || 0}€) {viewing.overtime_hours ? `+ (${viewing.overtime_hours}h × ${activityRates[viewing.id].detailed.garde_infi}€ × 1.5)` : ''}</div>
                          {viewing.remuneration_infi && <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {viewing.remuneration_infi} €</div>}
                        </div>
                      )}
                      {viewing.remuneration_med && activityRates[viewing.id].detailed?.garde_med && (
                        <div style={{marginTop:6}}>
                          <div>Médecin: ({viewing.garde_hours > 0 ? viewing.garde_hours : viewing.hours_actual || 0}h × {activityRates[viewing.id].detailed.garde_med}€) + ({viewing.sortie_hours || 0}h × {activityRates[viewing.id].detailed?.sortie_med || 0}€) {viewing.overtime_hours ? `+ (${viewing.overtime_hours}h × ${activityRates[viewing.id].detailed.garde_med}€ × 1.5)` : ''}</div>
                          <div style={{fontWeight:600,color:'#d97706',marginTop:4}}>= {viewing.remuneration_med} €</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                        <img src={viewing.proof_image} alt="ticket" style={{maxWidth:'100%',maxHeight:250,border:'2px solid #fcd34d',borderRadius:6,display:'block'}} />
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
