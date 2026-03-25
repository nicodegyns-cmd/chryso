import React, { useState } from 'react'

export default function RIBUploadBanner({ email }) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const fileInputRef = React.useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file is PDF
    if (file.type !== 'application/pdf') {
      setMessage('⚠️ Veuillez sélectionner un fichier PDF')
      setSuccess(false)
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('⚠️ Le fichier ne doit pas dépasser 5 MB')
      setSuccess(false)
      return
    }

    setUploading(true)
    setMessage('')

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
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de l\'upload')
      }

      setMessage('✅ Document RIB uploadé avec succès!')
      setSuccess(true)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setTimeout(() => {
        setMessage('')
      }, 5000)
    } catch (err) {
      setMessage('❌ ' + (err.message || 'Erreur lors de l\'upload'))
      setSuccess(false)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="admin-card card" style={{
      borderLeft: '4px solid #f59e0b',
      backgroundColor: '#fffbeb'
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '24px' }}>📋</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#d97706' }}>
            Document RIB requis
          </h3>
          <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '14px' }}>
            Veuillez nous fournir votre relevé d'identité bancaire (RIB) fourni par votre banque.
            Ceci est nécessaire pour traiter vos paiements.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
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
                backgroundColor: uploading ? '#ccc' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {uploading ? 'Upload en cours...' : '📁 Choisir un fichier PDF'}
            </button>
            <span style={{ fontSize: '12px', color: '#999' }}>
              Max 5 MB
            </span>
          </div>

          {message && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: success ? '#d1fae5' : '#fee2e2',
              color: success ? '#065f46' : '#991b1b',
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
