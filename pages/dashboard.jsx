import React from 'react'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import PrestationsTable from '../components/PrestationsTable'
import PrestationsStats from '../components/PrestationsStats'
import eBrigadePrestationsDisplay from '../components/eBrigadePrestationsDisplay'

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Accueil</h1>
          <div className="small-muted">Bienvenue — tableau de bord utilisateur</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          <div className="admin-card card">
            <p>Bienvenue — ci-dessous la liste de vos prestations.</p>
          </div>
          <PrestationsStats email={typeof window !== 'undefined' ? localStorage.getItem('email') : ''} />
          <eBrigadePrestationsDisplay email={typeof window !== 'undefined' ? localStorage.getItem('email') : ''} />
          <PrestationsTable email={typeof window !== 'undefined' ? localStorage.getItem('email') : ''} />
        </div>
      </main>
    </div>
  )
}
