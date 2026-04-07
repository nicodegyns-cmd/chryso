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
  const [ebrigadeId, setEbrigadeId] = React.useState(null)
  const prestationsTableRef = React.useRef(null)
  
  // Check user status: onboarding > pending validation > full access
  React.useEffect(() => {
    if (!userEmail) return
    
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === userEmail.toLowerCase())
        
        if (!me) return
        
        // Priority 1: If onboarding not complete, go to profile (only for INFI/MED roles)
        const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
        if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
          router.push('/profile')
        }
        // Priority 2: If onboarding complete but not active, show pending validation
        else if (!me.is_active) {
          router.push('/account-pending')
        }
      } catch (err) {
        console.error('Failed to check user status', err)
      }
    }
    
    checkStatus()
  }, [userEmail, router])
  
  // Fetch user's liaison_ebrigade_id when email changes
  React.useEffect(() => {
    if (!userEmail) return
    
    const token = localStorage.getItem('token')
    if (!token) return
    
    fetch(`/api/users/by-token`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(user => {
        console.log('[dashboard] User data:', user)
        setEbrigadeId(user.liaison_ebrigade_id || null)
      })
      .catch(e => console.error('[dashboard] Error fetching user:', e))
  }, [userEmail])
  
  // Force page reload when router query changes (for ebrigade_id changes)
  React.useEffect(() => {
    if (router.isReady && router.query.refresh) {
      // Clear the refresh param
      router.push(router.pathname, undefined, { shallow: false })
    }
  }, [router])

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
              
              <ActivitiesCards key={`${userEmail}-${ebrigadeId}`} email={userEmail} ebrigade_id={ebrigadeId} onEditActivity={handleEditActivity} />
              
              <EBrigadePrestationsDisplay email={userEmail} onSelectPrestation={handleSelectEBrigadePrestation} />\n              <PrestationsStats email={userEmail} />
              <PrestationsTable ref={prestationsTableRef} email={userEmail} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
