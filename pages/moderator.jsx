import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import AdminPrestationsSummary from '../components/AdminPrestationsSummary'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function ModeratorPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const userEmail = useLocalStorage('email', '')
  const role = useLocalStorage('role', null)
  const [filterAnalyticIds, setFilterAnalyticIds] = useState(null)

  useEffect(() => {
    // Wait for role to be initialized
    if (role === null) {
      console.log('[moderator.jsx] waiting for useLocalStorage to initialize (role is still null)')
      return
    }
    
    // Accept both english/french role strings for compatibility
    console.log('[moderator.jsx] guard check - role is:', role)
    if (role !== 'moderator' && role !== 'moderateur') {
      console.log('[moderator.jsx] redirecting to /login - role is not moderator')
      router.replace('/login')
    } else {
      console.log('[moderator.jsx] role is moderator, allowing access')
      setChecking(false)
    }
  }, [role, router])

  useEffect(() => {
    // Check user status: onboarding > pending validation
    if (!userEmail || !role) return
    
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
          router.replace('/profile')
        }
        // Priority 2: If onboarding complete but not active, show pending validation
        else if (!me.is_active) {
          router.replace('/account-pending')
        }

        // Load analytic filter from moderator's profile
        if (me.moderator_analytic_ids) {
          const ids = typeof me.moderator_analytic_ids === 'string'
            ? me.moderator_analytic_ids.split(',').map(s => s.trim()).filter(Boolean)
            : me.moderator_analytic_ids
          setFilterAnalyticIds(ids.length > 0 ? ids : null)
        }
      } catch (err) {
        console.error('Failed to check user status', err)
      }
    }
    
    checkStatus()
  }, [userEmail, role, router])

  if (checking) return <div style={{padding:20}}>Vérification des droits…</div>

  return (
    <div style={{padding:20}}>
      <AdminHeader />
      <header style={{margin:'20px 0 8px'}}>
        <h1 style={{margin:0}}>Accueil — Modérateur</h1>
        <p style={{margin:0,color:'#6b7280'}}>Valider les demandes de prestations</p>
      </header>

      <main style={{marginTop:16}}>
        <AdminPrestationsSummary filterAnalyticIds={filterAnalyticIds} />
      </main>
    </div>
  )
}
