import Link from 'next/link'

export default function UserSidebar({ open, onClose }) {
  return (
    <>
      {/* overlay for small screens */}
      {open && <div className="sidebar-overlay" onClick={() => onClose?.()} />}
      <aside className={`admin-sidebar user-sidebar ${open ? 'open' : ''}`} role="navigation" aria-label="Navigation utilisateur">
        <nav>
          <ul className="sidebar-list">
            <li><Link href="/dashboard" className="sidebar-btn">Accueil</Link></li>
            <li><Link href="/profile" className="sidebar-btn">Mon profil</Link></li>
            <li><Link href="/invoices" className="sidebar-btn">Mes factures</Link></li>
            <li><Link href="/documents" className="sidebar-btn">Mes documents</Link></li>
          </ul>
        </nav>
      </aside>
    </>
  )
}
