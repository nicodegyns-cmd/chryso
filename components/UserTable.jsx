import React, { useEffect, useState } from 'react'
import CreateUserModal from './CreateUserModal'

export default function UserTable() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  function loadUsers() {
    setLoading(true)
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch((err) => {
        console.error('Failed to load users', err)
        setUsers([])
      })
      .finally(() => setLoading(false))
  }

  function handleCreate(newUser, id) {
    // if id provided -> update, else create
    if (id) {
      return fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
        .then((r) => {
          if (!r.ok) return r.json().then((b) => Promise.reject(b))
          return r.json()
        })
        .then((data) => {
          setOpen(false)
          setEditing(null)
          setQuery('')
          loadUsers()
          return data
        })
        .catch((err) => {
          console.error('update user failed', err)
          setOpen(false)
          setEditing(null)
          return Promise.reject(err)
        })
    }

    return fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((b) => Promise.reject(b))
        return r.json()
      })
      .then((data) => {
        setOpen(false)
        setQuery('')
        loadUsers()
        if (data.emailExcluded) {
          alert(`⚠️ Utilisateur créé mais email non envoyé.\n\n${data.emailError || 'Adresse dans la liste d\'exclusion des invitations.'}`)
        }
        return data
      })
      .catch((err) => {
        console.error('create user failed', err)
        setOpen(false)
        return Promise.reject(err)
      })
  }

  function handleDeleteUser(userId, userEmail) {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${userEmail} ? Cette action est irréversible.`)) {
      setLoading(true)
      fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
        .then((r) => {
          if (!r.ok) throw new Error('Failed to delete user')
          return r.json()
        })
        .then(() => {
          loadUsers()
        })
        .catch((err) => {
          console.error('delete user failed', err)
          alert('Erreur lors de la suppression')
          setLoading(false)
        })
    }
  }

  const displayed = users.filter((u) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const name = ((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase()
    const roles = Array.isArray(u.role) ? u.role.join(' ') : (u.role || '')
    return (
      (u.email || '').toLowerCase().includes(q) ||
      name.includes(q) ||
      roles.toLowerCase().includes(q) ||
      String(u.liaisonId || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{padding:0}}>
      {/* En-tête */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:16}}>
          <div>
            <h2 style={{margin:'0 0 4px 0',fontSize:24,fontWeight:700,color:'#1f2937'}}>👥 Utilisateurs</h2>
            <p style={{margin:0,fontSize:13,color:'#6b7280'}}>Gestion des utilisateurs et des rôles</p>
          </div>
          <button 
            className="primary" 
            onClick={() => setOpen(true)}
            style={{padding:'12px 24px',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            ✨ Créer un utilisateur
          </button>
        </div>

        {/* Recherche */}
        <div style={{position:'relative',maxWidth:400}}>
          <div style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}>🔍</div>
          <input
            placeholder="Rechercher par email, nom, rôle..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width:'100%',
              padding:'12px 12px 12px 40px',
              borderRadius:8,
              border:'2px solid #e5e7eb',
              fontSize:14,
              transition:'all 0.2s',
              background:'white'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div style={{padding:32,textAlign:'center',color:'#9ca3af'}}>⏳ Chargement des utilisateurs...</div>
      ) : (
        <div style={{borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',background:'white'}}>
            <thead>
              <tr style={{background:'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',borderBottom:'2px solid #e5e7eb'}}>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Email</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Nom</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Rôles</th>
                <th style={{textAlign:'left',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Liaison</th>
                <th style={{textAlign:'center',padding:'16px',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.5px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((u, idx) => (
                <tr 
                  key={u.id}
                  style={{
                    borderBottom:'1px solid #e5e7eb',
                    background:idx % 2 === 0 ? '#fff' : '#f9fafb',
                    transition:'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f4ff'
                    e.currentTarget.style.boxShadow = 'inset 3px 0 0 #667eea'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9fafb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937',fontWeight:500}}>
                    {u.email}
                  </td>
                  <td style={{padding:'16px',fontSize:13,color:'#1f2937'}}>
                    {(u.first_name || u.firstName || '') + ' ' + (u.last_name || u.lastName || '')}
                  </td>
                  <td style={{padding:'16px'}}>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {Array.isArray(u.role) ? u.role.map(r => (
                        <span 
                          key={r}
                          style={{
                            display:'inline-block',
                            padding:'4px 10px',
                            borderRadius:20,
                            fontSize:11,
                            fontWeight:600,
                            background:r === 'admin' ? '#fecdd3' : r === 'moderator' ? '#dbeafe' : r === 'INFI' ? '#dcfce7' : '#fef3c7',
                            color:r === 'admin' ? '#991b1b' : r === 'moderator' ? '#0c4a6e' : r === 'INFI' ? '#166534' : '#92400e'
                          }}
                        >
                          {r}
                        </span>
                      )) : (
                        <span 
                          style={{
                            display:'inline-block',
                            padding:'4px 10px',
                            borderRadius:20,
                            fontSize:11,
                            fontWeight:600,
                            background:'#f3f4f6',
                            color:'#6b7280'
                          }}
                        >
                          {u.role || '-'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{padding:'16px',fontSize:13,color:'#6b7280'}}>
                    {u.liaison_ebrigade_id || u.liaisonId ? (
                      <span style={{display:'inline-block',padding:'4px 8px',background:'#e0f2fe',color:'#0369a1',borderRadius:4,fontSize:12}}>
                        {u.liaison_ebrigade_id || u.liaisonId}
                      </span>
                    ) : (
                      <span style={{color:'#d1d5db'}}>-</span>
                    )}
                  </td>
                  <td style={{padding:'16px',textAlign:'center'}}>
                    <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                      <button 
                        onClick={async () => {
                          try {
                            setLoading(true)
                            const resp = await fetch(`/api/admin/users/${u.id}`)
                            if (!resp.ok) throw new Error('failed to fetch user')
                            const body = await resp.json()
                            setEditing(body.user)
                            setOpen(true)
                          } catch (err) {
                            console.error('Failed to load user for edit', err)
                            setEditing(u)
                            setOpen(true)
                          } finally {
                            setLoading(false)
                          }
                        }}
                        style={{
                          padding:'8px 16px',
                          background:'#667eea',
                          color:'white',
                          border:'none',
                          borderRadius:6,
                          fontSize:12,
                          fontWeight:600,
                          cursor:'pointer',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#5568d3'}
                        onMouseLeave={(e) => e.target.style.background = '#667eea'}
                      >
                        ✏️ Éditer
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.email)}
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
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={5} style={{padding:32,textAlign:'center',color:'#9ca3af'}}>
                    {query ? '❌ Aucun utilisateur ne correspond à votre recherche' : '📭 Aucun utilisateur'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Informations */}
      {!loading && displayed.length > 0 && (
        <div style={{marginTop:12,fontSize:12,color:'#6b7280'}}>
          <strong>{displayed.length}</strong> utilisateur{displayed.length !== 1 ? 's' : ''} {query && 'trouvé' + (displayed.length !== 1 ? 's' : '')}
        </div>
      )}

      <CreateUserModal open={open} onClose={() => { setOpen(false); setEditing(null) }} onCreate={handleCreate} initial={editing} />
    </div>
  )
}
