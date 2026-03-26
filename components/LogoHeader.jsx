import { useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'

export default function LogoHeader({ src = '/assets/logo.png', alt = 'Application logo' }) {
  const [role, setRole] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [showLogout, setShowLogout] = useState(true)
  const [centered, setCentered] = useState(false)

  useEffect(() => {
    setRole(localStorage.getItem('role'))
    setMounted(true)
    try {
      // Hide logout button when rendering inside the login or reset page wrapper
      const isLoginPage = typeof document !== 'undefined' && !!document.querySelector('.page-root.login-page')
      const isResetPage = typeof document !== 'undefined' && !!document.querySelector('.page-root.reset-page')
      if (isLoginPage || isResetPage) {
        setShowLogout(false)
        setCentered(true)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  return (
    <div className="logo-header" style={{display:'flex',alignItems:'center',justifyContent: centered ? 'center' : 'space-between',gap:12}}>
      <img src={src} alt={alt} className="logo-image" />
      {mounted && role && showLogout && <LogoutButton small={true} />}
    </div>
  )
}
