import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

const ROLE_LABELS = {
  INFI: 'Infirmier·ère',
  MED: 'Médecin',
  admin: 'Administrateur',
  comptabilite: 'Comptabilité',
  moderator: 'Modérateur',
  user: 'Utilisateur'
}

export default function RoleSelector() {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState([])
  const [current, setCurrent] = useState(null)
  const router = useRouter()
  const ref = useRef()

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('roles') : null
    let parsed = null
    try { parsed = raw ? JSON.parse(raw) : null } catch(e) { parsed = null }
    if (Array.isArray(parsed) && parsed.length > 0) {
      setRoles(parsed)
    } else {
      const single = typeof window !== 'undefined' ? localStorage.getItem('role') : null
      if (single) setRoles([single])
    }
    setCurrent(typeof window !== 'undefined' ? localStorage.getItem('role') : null)
  }, [])

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  function selectRole(r) {
    if (!r) return
    localStorage.setItem('role', r)
    setCurrent(r)
    setOpen(false)
    // trigger client-side navigation to refresh UI based on role
    router.replace(router.asPath)
  }

  if (!roles || roles.length === 0) return null

  return (
    <div style={{position: 'relative'}} ref={ref}>
      <button className="top-btn" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="listbox">
        {ROLE_LABELS[current] || current || 'Rôle'} ▾
      </button>
      {open && (
        <div role="listbox" aria-label="Sélection du rôle" style={{position:'absolute',right:0,top:40,background:'#fff',border:'1px solid #e6e9ef',boxShadow:'0 6px 18px rgba(16,24,40,0.08)',borderRadius:8,zIndex:1200}}>
          {roles.map(r => (
            <div key={r} role="option" onClick={() => selectRole(r)} style={{padding:'8px 14px',cursor:'pointer',whiteSpace:'nowrap'}}>
              <strong style={{marginRight:8}}>{ROLE_LABELS[r] || r}</strong>
              <span style={{color:'#6b7280',fontSize:13}}>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
