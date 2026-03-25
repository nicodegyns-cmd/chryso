import React from 'react'
import Link from 'next/link'

export default function AdminSidebar({ onNavigate }) {
  return (
    <aside className="admin-sidebar" role="navigation" aria-label="Admin navigation">
      <nav>
        <ul className="sidebar-list">
          <li>
            <Link href="/admin" className="sidebar-btn" onClick={() => onNavigate && onNavigate('dashboard')}>
              Accueil
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="sidebar-btn" onClick={() => onNavigate && onNavigate('users')}>
              Utilisateurs
            </Link>
          </li>
          <li>
            <Link href="/admin/validation" className="sidebar-btn" onClick={() => onNavigate && onNavigate('validation')}>
              ✓ Validation utilisateurs
            </Link>
          </li>
          <li>
            <Link href="/admin/analytics" className="sidebar-btn" onClick={() => onNavigate && onNavigate('analytics')}>
              Analytique
            </Link>
          </li>
          <li>
            <Link href="/admin/activities" className="sidebar-btn" onClick={() => onNavigate && onNavigate('activities')}>
              Activité
            </Link>
          </li>
          <li>
            <Link href="/admin/generate-send" className="sidebar-btn" onClick={() => onNavigate && onNavigate('generate-send')}>
              Générer & Envoyer
            </Link>
          </li>
          <li>
            <Link href="/admin/prestations" className="sidebar-btn" onClick={() => onNavigate && onNavigate('prestations')}>
              Prestations
            </Link>
          </li>
          <li>
            <Link href="/admin/statistics" className="sidebar-btn" onClick={() => onNavigate && onNavigate('statistics')}>
              📊 Statistiques
            </Link>
          </li>
          <li>
            <Link href="/admin/rib-validation" className="sidebar-btn" onClick={() => onNavigate && onNavigate('rib-validation')}>
              📋 Validation des RIB
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
