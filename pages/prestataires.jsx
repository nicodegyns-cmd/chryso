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

  // Check user status: onboarding > pending validation > full access
  useEffect(() => {
    const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    if (email) {
      setUserEmail(email)
      
      async function checkStatus() {
        try {
          const res = await fetch('/api/admin/users')
          const data = await res.json()
          const list = data.users || []
          const me = list.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
          
          if (!me) return
          
          // Priority 1: If onboarding not complete, go to profile to complete it
          if (me.must_complete_profile) {
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
                    <th style={{textAlign:'left',padding:12}}>Email</th>
                    <th style={{textAlign:'left',padding:12}}>Nom</th>
                    <th style={{textAlign:'left',padding:12}}>Société</th>
                    <th style={{textAlign:'center',padding:12}}>RIB</th>
                    <th style={{textAlign:'center',padding:12}}>Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(u => (
                    <tr key={u.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:12}}>{u.email}</td>
                      <td style={{padding:12}}>{(u.first_name||'')+' '+(u.last_name||'')}</td>
                      <td style={{padding:12}}>{u.company || '-'}</td>
                      <td style={{padding:12,textAlign:'center'}}>
                        {u.rib_id ? (
                          <a href={u.rib_url || `/api/documents/serve?id=${u.rib_id}`} target="_blank" rel="noreferrer" style={{padding:'6px 10px',background:'#10b981',color:'#fff',borderRadius:6,textDecoration:'none'}}>Voir RIB</a>
                        ) : <span style={{color:'#9ca3af'}}>—</span>}
                      </td>
                      <td style={{padding:12,textAlign:'center'}}>
                        {u.fiche_id ? (
                          <a href={u.fiche_url || `/api/documents/serve?id=${u.fiche_id}`} target="_blank" rel="noreferrer" style={{padding:'6px 10px',background:'#3b82f6',color:'#fff',borderRadius:6,textDecoration:'none'}}>Voir fiche</a>
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
    </div>
  )
}
