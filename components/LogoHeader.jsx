import LogoutButton from './LogoutButton'

export default function LogoHeader({ src = '/assets/logo.png', alt = 'Application logo' }) {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
  return (
    <div className="logo-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <img src={src} alt={alt} className="logo-image" />
      {role && <LogoutButton small={true} />}
    </div>
  )
}
