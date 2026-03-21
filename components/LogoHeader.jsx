import { useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'

export default function LogoHeader({ src = '/assets/logo.png', alt = 'Application logo' }) {
  const [role, setRole] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setRole(localStorage.getItem('role'))
    setMounted(true)
  }, [])

  return (
    <div className="logo-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <img src={src} alt={alt} className="logo-image" />
      {mounted && role && <LogoutButton small={true} />}
    </div>
  )
}
