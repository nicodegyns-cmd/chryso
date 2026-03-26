import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    // If role is stored from login, redirect appropriately
    try {
      const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
      if (role === 'admin') {
        router.replace('/admin')
        return
      }
      if (role === 'moderator' || role === 'moderateur') {
        router.replace('/moderator')
        return
      }
      if (role === 'comptabilite') {
        router.replace('/comptabilite')
        return
      }
      if (role) {
        router.replace('/dashboard')
        return
      }
    } catch (err) {
      // ignore
    }
    router.replace('/login')
  }, [router])
  return null
}
