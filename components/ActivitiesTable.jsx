import React, { useEffect, useState } from 'react'
import CreateActivityModal from './CreateActivityModal'
import EBrigadeAnalyticsMappingSection from './EBrigadeAnalyticsMappingSection'

export default function ActivitiesTable(){
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [sendingIds, setSendingIds] = useState({})

  useEffect(()=>{ fetchItems() }, [])

  async function fetchItems(){
    setLoading(true)
    try{
      const r = await fetch('/api/admin/activities')
      if (!r.ok) throw new Error('failed')
      const data = await r.json()
      setItems(data.items || [])
    }catch(e){ console.error(e) }
    setLoading(false)
  }

  async function handleCreate(payload){
    try{
      const r = await fetch('/api/admin/activities', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      if (!r.ok) throw new Error('create failed')
      const { item } = await r.json()
      setItems(prev => [item, ...prev])
      setOpen(false)
    }catch(e){ console.error(e); alert('Erreur création') }
  }

  async function handleEditClick(id){
    try{
      const r = await fetch(`/api/admin/activities/${id}`)
      if (!r.ok) throw new Error('not found')
      const d = await r.json()
      setOpen(true)
      // pass the item as initial
      setEditingItem(d.item)
    }catch(e){ console.error(e); alert('Impossible de récupérer l\'activité') }
  }

  async function handleUpdate(id, payload){
    try{
      const r = await fetch(`/api/admin/activities/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      if (!r.ok) { const err = await r.json().catch(()=>({error:'error'})); throw new Error(err.error || 'update failed') }
      const { item } = await r.json()
      setItems(prev => prev.map(p => p.id === item.id ? item : p))
      setOpen(false)
      setEditingItem(null)
    }catch(e){ console.error(e); alert('Erreur mise à jour') }
  }

  async function handleDelete(id){
    if (!confirm('Supprimer cette activité ?')) return
    try{
      const r = await fetch(`/api/admin/activities/${id}`, { method: 'DELETE' })
      if (!r.ok && r.status !== 204) throw new Error('delete failed')
      setItems(prev => prev.filter(p => p.id !== id))
    }catch(e){ console.error(e); alert('Erreur suppression') }
  }

  async function handleGenerateSend(id){
    if (sendingIds[id]) return
    setSendingIds(prev => ({...prev, [id]: true}))
    try{
      const r = await fetch(`/api/admin/activities/${id}/send`, { method: 'POST' })
      if (!r.ok) {
        const err = await r.json().catch(()=>({error:'error'}))
        throw new Error(err.error || 'send failed')
      }
      const data = await r.json()
      alert(data.message || 'Génération lancée')
    }catch(e){ console.error(e); alert('Erreur lors de la génération') }
    finally{ setSendingIds(prev => { const c = {...prev}; delete c[id]; return c }) }
  }

  return (
    <div style={{padding:0}}>
      {/* En-tête */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:16}}>
          <div>
            <h2 style={{margin:'0 0 4px 0',fontSize:24,fontWeight:700,color:'#1f2937'}}>⚡ Activités</h2>
            <p style={{margin:0,fontSize:13,color:'#6b7280'}}>Gestion des activités et rémunérations</p>
          </div>
          <button 
            className="primary" 
            onClick={()=>setOpen(true)}
            style={{padding:'12px 24px',background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            ✨ Créer une activité
          </button>
        </div>
      </div>

      {/* Section Mappings eBrigade */}
      <EBrigadeAnalyticsMappingSection />

      {/* Tableau */}
      {loading ? (
        <div style={{padding:32,textAlign:'center',color:'#9ca3af'}}>⏳ Chargement des activités...</div>
      ) : (
        <div style={{borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',background:'white'}}>
            <thead>
              <tr style={{background:'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',borderBottom:'2px solid #e5e7eb'}}>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Analytique</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Code</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Type</th>
                <th style={{textAlign:'right',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Infi</th>
                <th style={{textAlign:'right',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Médecin</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Date</th>
                <th style={{textAlign:'center',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr 
                  key={it.id}
                  style={{
                    borderBottom:'1px solid #e5e7eb',
                    background:idx % 2 === 0 ? '#fff' : '#f9fafb',
                    transition:'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0fdf4'
                    e.currentTarget.style.boxShadow = 'inset 3px 0 0 #10b981'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9fafb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937',fontWeight:500}}>{it.analytic_name}</td>
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937',fontFamily:'monospace',fontWeight:600}}>{it.analytic_code}</td>
                  <td style={{padding:'16px'}}>
                    <span style={{display:'inline-block',padding:'4px 10px',background:it.pay_type === 'Permanence' ? '#dbeafe' : it.pay_type === 'Garde' ? '#fecdd3' : '#dbeafe',color:it.pay_type === 'Permanence' ? '#0c4a6e' : it.pay_type === 'Garde' ? '#991b1b' : '#0c4a6e',borderRadius:4,fontSize:12,fontWeight:600}}>
                      {it.pay_type}
                    </span>
                  </td>
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937',textAlign:'right',fontWeight:500}}>
                    {typeof it.remuneration_infi !== 'undefined' && it.remuneration_infi !== null ? Number(it.remuneration_infi).toFixed(2) + '€' : '-'}
                  </td>
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937',textAlign:'right',fontWeight:500}}>
                    {typeof it.remuneration_med !== 'undefined' && it.remuneration_med !== null ? Number(it.remuneration_med).toFixed(2) + '€' : '-'}
                  </td>
                  <td style={{padding:'16px',fontSize:13,color:'#6b7280'}}>
                    {it.date ? new Date(it.date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td style={{padding:'16px',textAlign:'center'}}>
                    <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                      <button 
                        onClick={()=>handleEditClick(it.id)}
                        style={{
                          padding:'8px 16px',
                          background:'#10b981',
                          color:'white',
                          border:'none',
                          borderRadius:6,
                          fontSize:12,
                          fontWeight:600,
                          cursor:'pointer',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#059669'}
                        onMouseLeave={(e) => e.target.style.background = '#10b981'}
                      >
                        ✏️ Éditer
                      </button>
                      <button 
                        onClick={()=>handleDelete(it.id)}
                        style={{
                          padding:'8px 16px',
                          background:'#ef4444',
                          color:'white',
                          border:'none',
                          borderRadius:6,
                          fontSize:12,
                          fontWeight:600,
                          cursor:'pointer',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{padding:32,textAlign:'center',color:'#9ca3af'}}>
                    📭 Aucune activité trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Informations */}
      {!loading && items.length > 0 && (
        <div style={{marginTop:12,fontSize:12,color:'#6b7280'}}>
          <strong>{items.length}</strong> activité{items.length !== 1 ? 's' : ''}
        </div>
      )}

      <CreateActivityModal open={open} onClose={()=>{setOpen(false); setEditingItem(null)}} onCreate={handleCreate} initial={editingItem} onUpdate={handleUpdate} />
    </div>
  )
}
