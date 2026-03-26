import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminPanel from '../components/AdminPanel'

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Simple client-side guard for development: check localStorage 'role'
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (role !== 'admin') {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [router, setChecking])

  if (checking) return <div style={{padding:20}}>Vérification des droits…</div>
  return (
    <div className="admin-page-root">
      <div className="admin-card">
        <AdminPanel />
      </div>
    </div>
  )
}
