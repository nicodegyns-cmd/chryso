import React, { useState, useEffect } from 'react'
import CreateAnalyticModal from './CreateAnalyticModal'

export default function AnalyticsTable(){
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems(){
    setLoading(true)
    try{
      const r = await fetch('/api/admin/analytics')
      if (!r.ok) throw new Error('failed')
      const data = await r.json()
      setItems(data.items || [])
    }catch(err){
      console.error('fetch analytics failed', err)
    }finally{
      setLoading(false)
    }
  }

  async function handleCreate(payload){
    try{
      const r = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      if (!r.ok) {
        const err = await r.json().catch(()=>({error:'error'}))
        throw new Error(err.error || 'create failed')
      }
      const { item } = await r.json()
      setItems(prev => [item, ...prev])
      setOpen(false)
      setEditingItem(null)
    }catch(err){
      console.error('create analytic failed', err)
      alert(err.message || 'Erreur lors de la création')
    }
  }

  async function handleEditClick(id){
    try{
      const r = await fetch(`/api/admin/analytics/${id}`)
      if (!r.ok) throw new Error('Not found')
      const data = await r.json()
      setEditingItem(data.item)
      setOpen(true)
    }catch(err){
      console.error('fetch analytic item failed', err)
      alert('Impossible de récupérer l\'analytique')
    }
  }

  async function handleDelete(id){
    if (!confirm('Confirmer la suppression de cette analytique ?')) return
    try{
      setProcessingId(id)
      const r = await fetch(`/api/admin/analytics/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(()=>({error:'error'}))
        throw new Error(err.error || 'delete failed')
      }
      setItems(prev => prev.filter(p => p.id !== id))
    }catch(err){
      console.error('delete analytic failed', err)
      alert(err.message || 'Erreur lors de la suppression')
    }finally{
      setProcessingId(null)
    }
  }

  async function handleUpdate(id, payload){
    try{
      const r = await fetch(`/api/admin/analytics/${id}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      if (!r.ok) {
        const err = await r.json().catch(()=>({error:'error'}))
        throw new Error(err.error || 'update failed')
      }
      const { item } = await r.json()
      setItems(prev => prev.map(p => p.id === item.id ? item : p))
      setOpen(false)
      setEditingItem(null)
    }catch(err){
      console.error('update analytic failed', err)
      alert(err.message || 'Erreur lors de la mise à jour')
    }
  }

  return (
    <div style={{padding:0}}>
      {/* En-tête */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:16}}>
          <div>
            <h2 style={{margin:'0 0 4px 0',fontSize:24,fontWeight:700,color:'#1f2937'}}>📊 Analytiques</h2>
            <p style={{margin:0,fontSize:13,color:'#6b7280'}}>Gestion des centres de coûts</p>
          </div>
          <button 
            className="primary" 
            onClick={() => { setEditingItem(null); setOpen(true); }}
            style={{padding:'12px 24px',background:'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            ✨ Créer une analytique
          </button>
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div style={{padding:32,textAlign:'center',color:'#9ca3af'}}>⏳ Chargement des analytiques...</div>
      ) : (
        <div style={{borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',background:'white'}}>
            <thead>
              <tr style={{background:'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',borderBottom:'2px solid #e5e7eb'}}>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Nom</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Analytique</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Code</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Entité</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>N° de compte</th>
                <th style={{textAlign:'center',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                return (
                  <tr 
                    key={it.id}
                    style={{
                      borderBottom:'1px solid #e5e7eb',
                      background:idx % 2 === 0 ? '#fff' : '#f9fafb',
                      transition:'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f4ff'
                      e.currentTarget.style.boxShadow = 'inset 3px 0 0 #8b5cf6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9fafb'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <td style={{padding:'16px',fontSize:13,color:'#1f2937',fontWeight:500}}>{it.name}</td>
                    <td style={{padding:'16px',fontSize:13,color:'#1f2937'}}>
                      <span style={{display:'inline-block',padding:'4px 10px',background:'#e0e7ff',color:'#3730a3',borderRadius:4,fontSize:12,fontWeight:600}}>
                        {it.analytic}
                      </span>
                    </td>
                    <td style={{padding:'16px',fontSize:13,color:'#1f2937',fontFamily:'monospace',fontWeight:600}}>
                      {it.code}
                    </td>
                    <td style={{padding:'16px',fontSize:13,color:'#6b7280'}}>
                      {it.entite ? (
                        <span style={{display:'inline-block',padding:'4px 8px',background:'#f3f4f6',color:'#374151',borderRadius:4,fontSize:12}}>
                          {it.entite}
                        </span>
                      ) : (
                        <span style={{color:'#d1d5db'}}>-</span>
                      )}
                    </td>
                    <td style={{padding:'16px',fontSize:13,color:'#374151',fontFamily:'monospace'}}>
                      {it.account_number ? (
                        <span style={{display:'inline-block',padding:'4px 8px',background:'#f0fdf4',color:'#166534',borderRadius:4,fontSize:12,fontWeight:600}}>
                          {it.account_number}
                        </span>
                      ) : (
                        <span style={{color:'#d1d5db'}}>-</span>
                      )}
                    </td>
                    <td style={{padding:'16px',textAlign:'center'}}>
                      <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                        <button
                          title="Éditer"
                          aria-label={`Éditer ${it.name}`}
                          onClick={() => handleEditClick(it.id)}
                          disabled={processingId === it.id}
                          style={{
                            padding:'8px 16px',
                            background:'#8b5cf6',
                            color:'white',
                            border:'none',
                            borderRadius:6,
                            fontSize:12,
                            fontWeight:600,
                            cursor:processingId === it.id ? 'not-allowed' : 'pointer',
                            transition:'all 0.2s',
                            opacity:processingId === it.id ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => !processingId && (e.target.style.background = '#7c3aed')}
                          onMouseLeave={(e) => !processingId && (e.target.style.background = '#8b5cf6')}
                        >
                          ✏️ Éditer
                        </button>
                        <button
                          title="Supprimer"
                          aria-label={`Supprimer ${it.name}`}
                          onClick={() => handleDelete(it.id)}
                          disabled={processingId === it.id}
                          style={{
                            padding:'8px 16px',
                            background:'#ef4444',
                            color:'white',
                            border:'none',
                            borderRadius:6,
                            fontSize:12,
                            fontWeight:600,
                            cursor:processingId === it.id ? 'not-allowed' : 'pointer',
                            transition:'all 0.2s',
                            opacity:processingId === it.id ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => !processingId && (e.target.style.background = '#dc2626')}
                          onMouseLeave={(e) => !processingId && (e.target.style.background = '#ef4444')}
                        >
                          {processingId === it.id ? '⏳ Suppression...' : '🗑️ Supprimer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{padding:32,textAlign:'center',color:'#9ca3af'}}>
                    📭 Aucune analytique trouvée
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
          <strong>{items.length}</strong> analytique{items.length !== 1 ? 's' : ''}
        </div>
      )}

      <CreateAnalyticModal open={open} onClose={() => { setOpen(false); setEditingItem(null); }} onCreate={handleCreate} initial={editingItem} onUpdate={handleUpdate} />
    </div>
  )
}
