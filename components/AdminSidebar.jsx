import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function AdminSidebar({ onNavigate }) {
  const router = useRouter()
  const path = router && (router.pathname || router.asPath || '')
  const isActive = (href) => {
    if (!path) return false
    if (href === '/admin') return path === '/admin'
    return path === href || path.startsWith(href)
  }

  return (
    <aside className="admin-sidebar" role="navigation" aria-label="Admin navigation">
      <nav>
        <ul className="sidebar-list">
          <li>
            <Link href="/admin" className={`sidebar-btn ${isActive('/admin') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('dashboard')}>
              Accueil
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className={`sidebar-btn ${isActive('/admin/users') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('users')}>
              Utilisateurs
            </Link>
          </li>
          <li>
            <Link href="/admin/validation" className={`sidebar-btn ${isActive('/admin/validation') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('validation')}>
              Validation utilisateurs
            </Link>
          </li>
          <li>
            <Link href="/admin/analytics" className={`sidebar-btn ${isActive('/admin/analytics') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('analytics')}>
              Analytique
            </Link>
          </li>
          <li>
            <Link href="/admin/activities" className={`sidebar-btn ${isActive('/admin/activities') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('activities')}>
              Activité
            </Link>
          </li>
          <li>
            <Link href="/admin/generate-send" className={`sidebar-btn ${isActive('/admin/generate-send') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('generate-send')}>
              Générer & Envoyer
            </Link>
          </li>
          <li>
            <Link href="/admin/send-message" className={`sidebar-btn ${isActive('/admin/send-message') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('send-message')}>
              📧 Envoyer un message
            </Link>
          </li>
          <li>
            <Link href="/admin/prestations" className={`sidebar-btn ${isActive('/admin/prestations') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('prestations')}>
              Prestations
            </Link>
          </li>
          <li>
            <Link href="/admin/manual-entry" className={`sidebar-btn ${isActive('/admin/manual-entry') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('manual-entry')}>
              Encodage Manuel
            </Link>
          </li>
          <li>
            <Link href="/admin/statistics" className={`sidebar-btn ${isActive('/admin/statistics') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('statistics')}>
              Statistiques
            </Link>
          </li>
          <li>
            <Link href="/admin/rib-validation" className={`sidebar-btn ${isActive('/admin/rib-validation') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('rib-validation')}>
              Validation des RIB
            </Link>
          </li>
          <li>
            <Link href="/admin/facturation" className={`sidebar-btn ${isActive('/admin/facturation') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('facturation')}>
              Facturation
            </Link>
          </li>
          <li>
            <Link href="/admin/security" className={`sidebar-btn ${isActive('/admin/security') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('security')}>
              🔒 Sécurité
            </Link>
          </li>
          <li>
            <Link href="/admin/audit" className={`sidebar-btn ${isActive('/admin/audit') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('audit')}>
              Audit
            </Link>
          </li>
          <li>
            <Link href="/admin/send-message" className={`sidebar-btn ${isActive('/admin/send-message') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('send-message')}>
              📧 Envoyer des messages
            </Link>
          </li>
          <li>
            <Link href="/admin/email-diagnostic" className={`sidebar-btn ${isActive('/admin/email-diagnostic') ? 'active' : ''}`} onClick={() => onNavigate && onNavigate('email-diagnostic')}>
              🧪 Diagnostic Email
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
