import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function AdminHeader({ onOpenRoles, logoSrc, onToggleSidebar }) {
  return (
    <div className="admin-topbar">
      <div className="admin-topbar-inner">
        <div className="admin-topbar-left">
          <button className="hamburger-btn" aria-label="Ouvrir le menu" onClick={() => onToggleSidebar?.()}>
            <span style={{display:'block',width:20,height:2,background:'#111',marginBottom:4}}></span>
            <span style={{display:'block',width:16,height:2,background:'#111',marginBottom:4}}></span>
            <span style={{display:'block',width:20,height:2,background:'#111'}}></span>
          </button>
          <img src={logoSrc || '/assets/logo.png'} alt="logo" className="admin-topbar-logo" />
        </div>

        <div className="admin-topbar-right">
          <button className="top-btn" onClick={() => onOpenRoles?.()} aria-haspopup="dialog">
            Sélectionner le rôle
          </button>
          <Link href="/profile" className="top-btn profile-btn">Profil</Link>
          <LogoutButton small={true} />
        </div>
      </div>
    </div>
  )
}
