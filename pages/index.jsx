import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    // If role is stored from login, redirect appropriately
    try {
      const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
      if (role === 'admin') return router.replace('/admin')
      if (role) return router.replace('/dashboard')
    } catch (err) {
      // ignore
    }
    router.replace('/login')
  }, [])
  return null
}
