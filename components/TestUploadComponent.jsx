import React, { useState } from 'react'

export default function TestUploadComponent() {
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const file = new File(['%PDF-1.4 test content'], 'test.pdf', { type: 'application/pdf' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('email', 'test@example.com')
      formData.append('documentType', 'TEST')

      console.log('FormData keys:', Array.from(formData.keys()))

      const res = await fetch('/api/test-upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      
      if (res.ok) {
        setResponse(data)
      } else {
        setError(data)
      }
    } catch (err) {
      setError({ message: err.message, stack: err.stack })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '20px' }}>
      <h3>🧪 Test Upload Endpoint</h3>
      <p style={{ color: '#666', fontSize: '14px' }}>
        This tests the busboy multipart parsing by uploading to /api/test-upload
      </p>
      
      <button 
        onClick={handleTest} 
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : '▶️ Run Debug Test'}
      </button>

      {response && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#d1fae5', borderRadius: '4px' }}>
          <strong>✅ Success:</strong>
          <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
          <strong>❌ Error:</strong>
          <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px', color: '#991b1b' }}>
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
