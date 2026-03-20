import { useRouter } from 'next/router'
import React from 'react'

export default function LogoutButton({ label = 'Déconnexion', small = false }){
  const router = useRouter()
  function handleLogout(){
    try{
      if (typeof window !== 'undefined'){
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        localStorage.removeItem('email')
      }
    }catch(e){}
    // redirect to login
    router.push('/login')
  }

  return (
    <button onClick={handleLogout} className={small ? 'logout-btn small' : 'logout-btn'} style={{marginLeft:8}}>
      {label}
    </button>
  )
}
