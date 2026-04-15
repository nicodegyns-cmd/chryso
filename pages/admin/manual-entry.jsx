import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import ManualHourEntry from '../../components/ManualHourEntry'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function ManualEntryPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const role = useLocalStorage('role', null)

  useEffect(() => {
    if (role === null) return
    if (role !== 'admin') {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [role, router])

  if (checking) return <div style={{padding: 20}}>Vérification des droits…</div>

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Encodage manuel des heures</h1>
          <div className="small-muted">Saisir les heures d’un utilisateur manuellement</div>
        </div>
        <ManualHourEntry />
      </main>
    </div>
  )
}
