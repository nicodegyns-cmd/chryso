import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function UserSidebar({ open, onClose }) {
  const [role, setRole] = useState(null)
  const router = useRouter()
  const path = router && (router.pathname || router.asPath || '')

  useEffect(() => {
    try {
      const r = typeof window !== 'undefined' ? localStorage.getItem('role') : null
      setRole(r)
    } catch (e) {
      setRole(null)
    }
  }, [])

  const isCompta = role === 'comptabilite'

  return (
    <>
      {/* overlay for small screens */}
      {open && <div className="sidebar-overlay" onClick={() => onClose?.()} />}
      <aside className={`admin-sidebar user-sidebar ${open ? 'open' : ''}`} role="navigation" aria-label="Navigation utilisateur">
        <nav>
          <ul className="sidebar-list">
            <li><Link href="/dashboard" className={`sidebar-btn ${path === '/dashboard' ? 'active' : ''}`}>Accueil</Link></li>
            <li><Link href="/profile" className={`sidebar-btn ${path === '/profile' ? 'active' : ''}`}>Mon profil</Link></li>
            {isCompta ? (
              <>
                <li><Link href="/invoices" className={`sidebar-btn ${path.startsWith('/invoices') ? 'active' : ''}`}>Factures</Link></li>
                <li><Link href="/prestataires" className={`sidebar-btn ${path.startsWith('/prestataires') ? 'active' : ''}`}>Prestataire</Link></li>
              </>
            ) : (
              <>
                <li><Link href="/invoices" className={`sidebar-btn ${path.startsWith('/invoices') ? 'active' : ''}`}>Mes factures</Link></li>
                <li><Link href="/documents" className={`sidebar-btn ${path.startsWith('/documents') ? 'active' : ''}`}>Mes documents</Link></li>
              </>
            )}
          </ul>
        </nav>
      </aside>
    </>
  )
}
