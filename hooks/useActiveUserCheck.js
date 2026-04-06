/**
 * Hook to check if user is active, redirect to pending page if not
 */
export function useActiveUserCheck() {
  const [loading, setLoading] = React.useState(true)
  const [user, setUser] = React.useState(null)
  const [isActive, setIsActive] = React.useState(false)

  React.useEffect(() => {
    async function check() {
      const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
      if (!email) {
        if (typeof window !== 'undefined') window.location.href = '/login'
        return
      }

      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
        
        if (!me) {
          if (typeof window !== 'undefined') window.location.href = '/login'
          return
        }

        setUser(me)

        // If user is not active, redirect to pending page
        if (!me.is_active) {
          if (typeof window !== 'undefined') window.location.href = '/account-pending'
          return
        }

        setIsActive(true)
      } catch (err) {
        console.error('Failed to check user status', err)
      } finally {
        setLoading(false)
      }
    }

    check()
  }, [])

  return { loading, user, isActive }
}
