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
      if (!localStorage.getItem('role')) localStorage.setItem('role', parsed[0])
      setCurrent(localStorage.getItem('role'))
    } else {
      const single = typeof window !== 'undefined' ? localStorage.getItem('role') : null
      if (single) {
        // support legacy comma-separated string in `role` e.g. "admin,INFI,moderator"
        if (single.includes(',')) {
          const parts = single.split(',').map(s => s.trim()).filter(Boolean)
          if (parts.length > 0) {
            setRoles(parts)
            // ensure canonical storage of roles array for future use
            try { localStorage.setItem('roles', JSON.stringify(parts)) } catch(e) {}
            // keep the first as active if not set
            if (!localStorage.getItem('role')) localStorage.setItem('role', parts[0])
            setCurrent(parts[0])
          }
        } else {
          setRoles([single])
          setCurrent(single)
        }
      }
    }
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
    // Emit custom event so hooks/pages can react to role change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localStorageChanged', { detail: { key: 'role', value: r } }))
    }
    // Delay slightly to ensure localStorage is synced, then navigate to appropriate page
    setTimeout(() => {
      if (r === 'admin') router.push('/admin')
      else if (r === 'comptabilite') router.push('/comptabilite')
      else if (r === 'moderator') router.push('/moderator')
      else router.push('/')
    }, 100)
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
