import React, { useEffect, useState } from 'react'

export default function EBrigadePrestationsDisplay({ email }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    console.log('[EBRIGADE] Component loaded')
    if (typeof window !== 'undefined') {
      window.EBRIGADE_LOADED = true
      console.warn('EBRIGADE COMPONENT IS RENDERING!')
    }
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="admin-card card" style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:8}}>
        <p style={{color:'#d97706',fontWeight:'bold'}}>⚙️ Initialisation eBrigade...</p>
      </div>
    )
  }

  return (
    <div className="admin-card card" style={{background:'#d1fae5',border:'2px solid #10b981',borderRadius:8}}>
      <h3 style={{color:'#059669'}}>✅ Vos gardes eBrigade</h3>
      <p style={{color:'#047857'}}>Composant ACTIF - Version Test</p>
    </div>
  )
}
