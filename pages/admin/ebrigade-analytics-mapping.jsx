import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import EBrigadeAnalyticsMappingManager from '../../components/EBrigadeAnalyticsMappingManager'
import { useLocalStorage } from '../../hooks/useLocalStorage'

export default function EBrigadeAnalyticsMappingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const role = useLocalStorage('role', null)

  useEffect(() => {
    if (role === null) {
      return
    }
    if (role !== 'admin') {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [role, router])

  if (checking) return <div style={{padding:20}}>Vérification des droits…</div>

  return (
    <div className="admin-root">
      <AdminHeader />
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <h1>Mappings eBrigade</h1>
          <p className="muted">Associer les analytiques eBrigade avec les analytiques locales</p>
        </header>
        <section>
          <EBrigadeAnalyticsMappingManager />
        </section>
      </div>
    </div>
  )
}
