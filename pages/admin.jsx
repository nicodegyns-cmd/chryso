import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminPanel from '../components/AdminPanel'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userEmail, setUserEmail] = useLocalStorage('email', '')
  const role = useLocalStorage('role', null)

  useEffect(() => {
    // Wait for the hook to have read the initial value
    if (role === null) {
      console.log('[admin.jsx] waiting for useLocalStorage to initialize (role is still null)')
      return
    }
    
    // Check if user has admin role
    console.log('[admin.jsx] guard check - role is:', role)
    if (role !== 'admin') {
      console.log('[admin.jsx] redirecting to /login - role is not admin')
      router.replace('/login')
    } else {
      console.log('[admin.jsx] role is admin, allowing access')
      setChecking(false)
    }
  }, [role, router])

  useEffect(() => {
    // Also check if admin user is active (for security)
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
    <div className="admin-page-root">
      <div className="admin-card">
        <AdminPanel />
      </div>
    </div>
  )
}
