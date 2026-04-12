import React, { useState, useEffect } from 'react'

export default function RIBUploadBanner({ email }) {
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [ribStatus, setRibStatus] = useState(null) // null=loading, 'none', 'pending', 'approved', 'rejected'
  const fileInputRef = React.useRef(null)

  useEffect(() => {
    if (!email) return
    checkExistingRib()
  }, [email])

  async function checkExistingRib() {
    try {
      const r = await fetch('/api/documents?email=' + encodeURIComponent(email))
      if (!r.ok) { setRibStatus('none'); return }
      const data = await r.json()
      const docs = data.documents || []
      const rib = docs.find(d => (d.name || '').toLowerCase().includes('rib') || (d.type || '').toUpperCase() === 'RIB')
      if (!rib) { setRibStatus('none'); return }
      setRibStatus(rib.validation_status || 'pending')
    } catch (e) {
      setRibStatus('none')
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setErrorMsg('Veuillez sélectionner un fichier PDF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Le fichier ne doit pas dépasser 5 MB')
      return
    }

    setUploading(true)
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('email', email)
      formData.append('documentType', 'RIB')

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        let msg = 'Erreur lors de l\'upload'
        try {
          const d = await response.json()
          msg = d.error || d.details || msg
        } catch (e) {}
        throw new Error(msg)
      }

      setRibStatus('pending')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  // Still loading
  if (ribStatus === null) return null

  // Already approved - hide banner
  if (ribStatus === 'approved') return null

  // Pending - show persistent waiting indicator
  if (ribStatus === 'pending') {
    return (
      <div style={{
        borderLeft: '4px solid #f59e0b',
        backgroundColor: '#fffbeb',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        marginBottom: 16
      }}>
        <div style={{ fontSize: 24, marginTop: 2 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h3 style={{ margin: 0, color: '#d97706', fontSize: 16 }}>Document RIB envoyé</h3>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 20,
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              fontSize: 12,
              fontWeight: 600
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: '#f59e0b',
                display: 'inline-block',
                animation: 'pulse 2s infinite'
              }} />
              En attente de validation
            </span>
          </div>
          <p style={{ margin: 0, color: '#78716c', fontSize: 13 }}>
            Votre RIB a été reçu et est en cours de vérification par notre équipe. Vous serez notifié dès qu’il est validé.
          </p>
        </div>
      </div>
    )
  }

  // None or rejected - show upload form
  return (
    <div style={{
      borderLeft: '4px solid #f59e0b',
      backgroundColor: '#fffbeb',
      borderRadius: 8,
      padding: '16px 20px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      marginBottom: 16
    }}>
      <div style={{ fontSize: 24, marginTop: 2 }}>📋</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 6px 0', color: '#d97706', fontSize: 16 }}>
          {ribStatus === 'rejected' ? 'RIB rejeté — veuillez en soumettre un nouveau' : 'Document RIB requis'}
        </h3>
        <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: 13 }}>
          Veuillez nous fournir votre relevé d’identité bancaire (RIB) fourni par votre banque.
          Ceci est nécessaire pour traiter vos paiements.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '8px 16px',
              backgroundColor: uploading ? '#d1d5db' : '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {uploading ? 'Upload en cours…' : '📁 Choisir un fichier PDF'}
          </button>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Max 5 MB</span>
        </div>

        {errorMsg && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: 6,
            fontSize: 13
          }}>
            ❌ {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}
