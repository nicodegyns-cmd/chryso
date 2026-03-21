import React, { useEffect, useState } from 'react'

export default function eBrigadePrestationsDisplay({ email }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    console.log('[EBRIGADE] Component loaded')
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="admin-card card"><p>Initialisation...</p></div>
  }

  return (
    <div className="admin-card card">
      <h3>Vos gardes eBrigade</h3>
      <p>Composant eBrigade actif</p>
    </div>
  )
}
