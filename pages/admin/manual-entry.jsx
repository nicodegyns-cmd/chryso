import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import ManualHourEntry from '../../components/ManualHourEntry'

export default function ManualEntryPage() {
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

  if (checking) return <div style={{padding: 20}}>Vérification des droits…</div>

  return (
    <div className="admin-page-root">
      <div className="admin-card">
        <ManualHourEntry />
      </div>
    </div>
  )
}
