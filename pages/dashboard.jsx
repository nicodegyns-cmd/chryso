import React from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import ActivitiesCards from '../components/ActivitiesCards'
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
  const prestationsTableRef = React.useRef(null)

  // Handle when user clicks on an activity card to edit/declare hours
  const handleEditActivity = React.useCallback((activity) => {
    console.log('[dashboard] handleEditActivity called with:', activity)
    console.log('[dashboard] prestationsTableRef.current:', prestationsTableRef.current)
    if (prestationsTableRef.current?.openEdit) {
      console.log('[dashboard] calling openEdit()')
      prestationsTableRef.current.openEdit(activity)
    } else {
      console.warn('[dashboard] openEdit not found on ref:', prestationsTableRef.current)
    }
  }, [])

  // Handle when user selects an eBrigade prestation to declare hours
  const handleSelectEBrigadePrestation = React.useCallback((ebrigadePrestation) => {
    console.log('[dashboard] handleSelectEBrigadePrestation called with:', ebrigadePrestation)
    
    // Convert eBrigade prestation to our internal prestation format
    const prestation = {
      isEBrigade: true,
      isActivity: true,  // Must be true to trigger eBrigade-specific form in PrestationsTable
      source: 'ebrigade',
      // eBrigade unique ID (for request reference): use activity code (4 digits) when available
      ebrigade_id: ebrigadePrestation.activityCode || ebrigadePrestation.id,
      // eBrigade data
      ebrigade_personnel_id: ebrigadePrestation.personnel?.id,
      ebrigade_personnel_name: `${ebrigadePrestation.personnel?.prenom || ''} ${ebrigadePrestation.personnel?.nom || ''}`.trim(),
      ebrigade_activity_code: ebrigadePrestation.activityCode,
      ebrigade_activity_name: ebrigadePrestation.activity,
      ebrigade_activity_type: ebrigadePrestation.activityType,
      ebrigade_duration_hours: ebrigadePrestation.duration,
      ebrigade_start_time: ebrigadePrestation.startTime,
      ebrigade_end_time: ebrigadePrestation.endTime,
      // Date and basic info
      date: ebrigadePrestation.date,
      dateEnd: ebrigadePrestation.dateEnd,
      // User info
      email: userEmail,
      user_email: userEmail,
      status: 'À saisir',
      // Hours (to be filled by user)
      hours_actual: null,
      garde_hours: null,
      sortie_hours: null,
      overtime_hours: null,
      // Other fields
      comments: null,
      expense_amount: null,
      expense_comment: null
    }
    
    if (prestationsTableRef.current?.openEdit) {
      console.log('[dashboard] calling openEdit() with eBrigade prestation')
      prestationsTableRef.current.openEdit(prestation)
    } else {
      console.warn('[dashboard] openEdit not found on ref:', prestationsTableRef.current)
    }
  }, [userEmail])

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
              
              <ActivitiesCards email={userEmail} onEditActivity={handleEditActivity} />
              
              <EBrigadePrestationsDisplay email={userEmail} onSelectPrestation={handleSelectEBrigadePrestation} />\n              <PrestationsStats email={userEmail} />
              <PrestationsTable ref={prestationsTableRef} email={userEmail} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
