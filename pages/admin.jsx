import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminPanel from '../components/AdminPanel'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const role = useLocalStorage('role', null)

  useEffect(() => {
    // Check if user has admin role
    if (role !== 'admin') {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [role, router])

  if (checking) return <div style={{padding:20}}>Vérification des droits…</div>
  return (
    <div className="admin-page-root">
      <div className="admin-card">
        <AdminPanel />
      </div>
    </div>
  )
}
