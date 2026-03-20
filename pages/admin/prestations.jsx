import React from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import PrestationsTable from '../../components/PrestationsTable'
import { useState, useEffect } from 'react'

function CreateScheduleModal({ onClose, onCreated }){
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
    const [activities, setActivities] = useState([])
    const [activityId, setActivityId] = useState('')
  const [type, setType] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    fetch('/api/admin/users')
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(d=> setUsers(d.users || []))
      .catch(()=> setUsers([]))
  }, [])

  useEffect(()=>{
    fetch('/api/admin/activities')
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(d=> setActivities(d.items || []))
      .catch(()=> setActivities([]))
  }, [])

  async function create(){
    if (!userId || !type || !date) return alert('Veuillez remplir tous les champs')
    setLoading(true)
    try{
      const payload = { user_id: userId, type, date }
      if (activityId) payload.activity_id = activityId
      const r = await fetch('/api/admin/prestations/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const text = await r.text()
      let d
      try{ d = JSON.parse(text) }catch(e){ d = { error: text || 'unknown' } }
      if (!r.ok) {
        console.error('generate failed', r.status, d)
        const msg = d && d.error ? d.error : `Erreur serveur (${r.status})`
        return alert('Erreur lors de la génération: ' + msg)
      }
      onCreated && onCreated(d)
      onClose()
    }catch(e){
      console.error('generate failed', e)
      alert('Erreur lors de la génération: ' + (e && e.message ? e.message : 'unknown'))
    }finally{ setLoading(false) }
  }

  return (
    <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:520,background:'#fff',padding:18,borderRadius:6}}>
        <h3>Créer un horaire (génération)</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          <label>Profil disponible
            <select value={userId} onChange={e=>setUserId(e.target.value)}>
              <option value="">-- sélectionnez --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email} {u.fonction ? `(${u.fonction})` : ''}</option>)}
            </select>
          </label>
            <label>Activité (optionnel)
              <select value={activityId} onChange={e=>setActivityId(e.target.value)}>
                <option value="">-- aucune --</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.analytic_name || a.analytic_code || `#${a.id}`} {a.date ? `(${a.date})` : ''}</option>)}
              </select>
            </label>
          <label>Type de prestation
            <input value={type} onChange={e=>setType(e.target.value)} placeholder="ex: Garde, Permanence, APS" />
          </label>
          <label>Date
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </label>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
          <button onClick={onClose} disabled={loading}>Annuler</button>
          <button onClick={create} disabled={loading}>{loading ? 'Génération...' : 'Générer'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPrestationsPage(){
  const [showCreate, setShowCreate] = useState(false)
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Prestations</h1>
          <div className="small-muted">Tableau récapitulatif des prestations enregistrées par les utilisateurs.</div>
          <div style={{marginTop:12}}>
            <button onClick={()=>setShowCreate(true)} style={{background:'#0366d6',color:'#fff',padding:'8px 12px',borderRadius:6,border:'none'}}>Créer un horaire (générer)</button>
          </div>
        </div>
        <div className="admin-card card">
          <PrestationsTable />
        </div>
      </main>
      {showCreate && <CreateScheduleModal onClose={()=>setShowCreate(false)} onCreated={(d)=>{ console.log('generated', d) }} />}
    </div>
  )
}
