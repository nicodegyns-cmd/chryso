import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'

export default function PrestatairesPage(){
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [ribViewer, setRibViewer] = useState(null)
  const [ficheViewer, setFicheViewer] = useState(null)

  // Check user status: onboarding > pending validation > full access
  useEffect(() => {
    const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    if (email) {
      setUserEmail(email)
      setUserRole(localStorage.getItem('role') || '')
      
      async function checkStatus() {
        try {
          const res = await fetch('/api/admin/users')
          const data = await res.json()
          const list = data.users || []
          const me = list.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
          
          if (!me) return
          
          // Priority 1: If onboarding not complete, go to profile (only for INFI/MED roles)
          const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
          if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
            router.push('/profile')
          }
          // Priority 2: If onboarding complete but not active, show pending validation
          else if (!me.is_active) {
            router.push('/account-pending')
          }
        } catch (err) {
          console.error('Failed to check user status', err)
        }
      }
      
      checkStatus()
    }
  }, [router])

  useEffect(()=>{ load() }, [])

  async function load(){
    setLoading(true)
    try{
      const r = await fetch('/api/admin/prestataires')
      if (!r.ok) throw new Error('fetch failed')
      const d = await r.json()
      setUsers(d.users || [])
    }catch(e){ console.error(e); setUsers([]) }
    finally{ setLoading(false) }
  }

  const displayed = users.filter(u => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (u.email||'').toLowerCase().includes(q) || ((u.first_name||'')+' '+(u.last_name||'')).toLowerCase().includes(q) || (u.company||'').toLowerCase().includes(q)
  })

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Prestataires</h1>
          <div className="small-muted">Liste des utilisateurs — accès rapide aux documents RIB et fiches</div>
        </div>

        <div style={{marginTop:12}}>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
            <input placeholder="Recherche par email, nom ou société" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e5e7eb',minWidth:320}} />
            <button onClick={load} className="primary" style={{padding:'8px 12px',borderRadius:8}}>Rafraîchir</button>
          </div>

          {loading ? (
            <div style={{padding:24,color:'#6b7280'}}>Chargement…</div>
          ) : (
            <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f3f4f6',borderBottom:'1px solid #e5e7eb'}}>
                    {userRole !== 'comptabilite' && <th style={{textAlign:'left',padding:12}}>Email</th>}
                    <th style={{textAlign:'left',padding:12}}>Nom</th>
                    <th style={{textAlign:'left',padding:12}}>Société</th>
                    <th style={{textAlign:'center',padding:12}}>RIB</th>
                    <th style={{textAlign:'center',padding:12}}>Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(u => (
                    <tr key={u.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                      {userRole !== 'comptabilite' && <td style={{padding:12}}>{u.email}</td>}
                      <td style={{padding:12}}>{(u.first_name||'')+' '+(u.last_name||'')}</td>
                      <td style={{padding:12}}>{u.company || '-'}</td>
                      <td style={{padding:12,textAlign:'center'}}>
                        {u.rib_id ? (
                          <button onClick={() => setRibViewer(u)} style={{padding:'6px 10px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Voir RIB</button>
                        ) : <span style={{color:'#9ca3af'}}>—</span>}
                      </td>
                      <td style={{padding:12,textAlign:'center'}}>
                        {u.is_active ? (
                          <button onClick={() => setFicheViewer(u)} style={{padding:'6px 10px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Voir fiche</button>
                        ) : <span style={{color:'#9ca3af'}}>—</span>}
                      </td>
                    </tr>
                  ))}
                  {displayed.length === 0 && (
                    <tr><td colSpan={5} style={{padding:24,textAlign:'center',color:'#9ca3af'}}>Aucun résultat</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      {ficheViewer && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => setFicheViewer(null)}>
          <div style={{background:'#fff',borderRadius:10,width:'95%',maxWidth:600,maxHeight:'90vh',overflow:'auto',padding:40,boxShadow:'0 10px 40px rgba(0,0,0,0.3)'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:30}}>
              <div>
                <h1 style={{margin:'0 0 8px 0',fontSize:28,fontWeight:700,color:'#111827'}}>{(ficheViewer.first_name||'')+' '+(ficheViewer.last_name||'')}</h1>
                <p style={{margin:0,fontSize:14,color:'#6b7280'}}>Fiche renseignement</p>
              </div>
              <button onClick={() => setFicheViewer(null)} style={{border:'none',background:'transparent',fontSize:24,cursor:'pointer',padding:0,color:'#6b7280'}}>✕</button>
            </div>
            <div style={{marginBottom:24}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations personnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Email</label><p style={{margin:0,fontSize:15,color:'#111827'}}>{ficheViewer.email}</p></div>
                {ficheViewer.telephone && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Téléphone</label><p style={{margin:0,fontSize:15,color:'#111827'}}>{ficheViewer.telephone}</p></div>}
                {ficheViewer.address && <div style={{gridColumn:'1/-1'}}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Adresse</label><p style={{margin:0,fontSize:15,color:'#111827'}}>{ficheViewer.address}</p></div>}
                {ficheViewer.ninami && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>N'INAMI</label><p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{ficheViewer.ninami}</p></div>}
              </div>
            </div>
            <div style={{paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations professionnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {ficheViewer.role && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Rôle</label><span style={{background:'#e0e7ff',color:'#3730a3',padding:'4px 10px',borderRadius:4,fontSize:13,fontWeight:600}}>{ficheViewer.role}</span></div>}
                {ficheViewer.fonction && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Fonction</label><p style={{margin:0,fontSize:15,color:'#111827'}}>{ficheViewer.fonction}</p></div>}
                {ficheViewer.company && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Entreprise</label><p style={{margin:0,fontSize:15,color:'#111827'}}>{ficheViewer.company}</p></div>}
                {ficheViewer.niss && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>NISS</label><p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{ficheViewer.niss}</p></div>}
                {ficheViewer.bce && <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>BCE</label><p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{ficheViewer.bce}</p></div>}
                {ficheViewer.account && <div style={{gridColumn:'1/-1'}}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Compte bancaire</label><p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{ficheViewer.account}</p></div>}
              </div>
            </div>
            <div style={{marginTop:30,paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <button onClick={() => setFicheViewer(null)} style={{width:'100%',padding:'10px 16px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      {ribViewer && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200}} onClick={() => setRibViewer(null)}>
          <div style={{background:'#fff',borderRadius:10,width:'95%',maxWidth:900,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}>
              <div>
                <strong style={{fontSize:16}}>🧾 RIB — {(ribViewer.first_name||'')+' '+(ribViewer.last_name||'')}</strong>
                {ribViewer.company && <span style={{marginLeft:12,color:'#6b7280',fontSize:14}}>🏢 {ribViewer.company}</span>}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <a href={`/api/documents/serve?id=${ribViewer.rib_id}`} download style={{padding:'6px 12px',background:'#6b7280',color:'#fff',borderRadius:6,textDecoration:'none',fontSize:14}}>Télécharger</a>
                <button onClick={() => setRibViewer(null)} style={{border:'none',background:'transparent',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
              </div>
            </div>
            <iframe
              src={`/api/documents/serve?id=${ribViewer.rib_id}`}
              style={{flex:1,border:'none',minHeight:'75vh'}}
              title="RIB"
            />
          </div>
        </div>
      )}
    </div>
  )
}
