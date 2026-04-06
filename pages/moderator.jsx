import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import AdminPrestationsSummary from '../components/AdminPrestationsSummary'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function ModeratorPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userEmail, setUserEmail] = useLocalStorage('email', '')
  const role = useLocalStorage('role', null)

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
    // Also check if user is active
    if (!userEmail || !role) return
    
    async function checkActive() {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === userEmail.toLowerCase())
        
        if (me && !me.is_active) {
          router.replace('/account-pending')
        }
      } catch (err) {
        console.error('Failed to check user status', err)
      }
    }
    
    checkActive()
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
        <AdminPrestationsSummary />
      </main>
    </div>
  )
}
