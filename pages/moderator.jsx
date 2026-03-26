import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import AdminPrestationsSummary from '../components/AdminPrestationsSummary'

export default function ModeratorPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    // Accept both english/french role strings for compatibility
    if (role !== 'moderator' && role !== 'moderateur') {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [router])

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
