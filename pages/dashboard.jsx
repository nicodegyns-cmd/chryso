import React from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import PrestationsTable from '../components/PrestationsTable'
import PrestationsStats from '../components/PrestationsStats'
import EBrigadePrestationsDisplay from '../components/eBrigadePrestationsDisplay'
import RIBUploadBanner from '../components/RIBUploadBanner'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function DashboardPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const userEmail = useLocalStorage('email', '')
  const userRole = useLocalStorage('role', null)

  // Redirect comptabilité users to comptabilite page
  React.useEffect(() => {
    // Only redirect if userRole has been initialized
    if (userRole !== null && userRole === 'comptabilite') {
      console.log('[dashboard.jsx] redirecting comptabilite user to /comptabilite')
      router.push('/comptabilite')
    }
  }, [userRole, router])

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        {userRole === 'comptabilite' ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
            <div style={{fontSize: 14}}>⏳ Redirection en cours...</div>
          </div>
        ) : (
          <>
            <div className="admin-header">
              <h1>Accueil</h1>
              <div className="small-muted">Bienvenue — tableau de bord utilisateur</div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div className="admin-card card">
                <p>Bienvenue — ci-dessous la liste de vos prestations et activités disponibles.</p>
              </div>
              
              <RIBUploadBanner email={userEmail} />
              
              <EBrigadePrestationsDisplay email={userEmail} />
              <PrestationsStats email={userEmail} />
              <PrestationsTable email={userEmail} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
