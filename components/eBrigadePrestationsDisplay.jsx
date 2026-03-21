import React, { useEffect, useState } from 'react'

export default function eBrigadePrestationsDisplay({ email }) {
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Initialize dates on mount
  useEffect(() => {
    if (!initialized) {
      const today = new Date()
      const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const formatDate = (d) => d.toISOString().split('T')[0]
      setDateFrom(formatDate(today))
      setDateTo(formatDate(inSevenDays))
      setInitialized(true)
    }
  }, [initialized])

  // Load data when dates are set
  useEffect(() => {
    if (initialized && dateFrom && dateTo) {
      loadEBrigadePrestations()
    }
  }, [dateFrom, dateTo, initialized])

  async function loadEBrigadePrestations() {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/user/ebrigade-prestations', window.location.origin)
      if (dateFrom) url.searchParams.set('dDebut', dateFrom)
      if (dateTo) url.searchParams.set('dFin', dateTo)

      const r = await fetch(url.toString())
      if (r.status === 401) {
        setError('Non authentifié')
        setPrestations([])
        return
      }
      if (r.status === 400) {
        setError('Vous n\'avez pas lié votre profil eBrigade')
        setPrestations([])
        return
      }
      if (!r.ok) throw new Error(`Erreur ${r.status}`)

      const data = await r.json()
      if (data.success && Array.isArray(data.prestations)) {
        setPrestations(data.prestations)
      } else {
        setError('Format de réponse invalide')
        setPrestations([])
      }
    } catch (err) {
      setError(err.message || 'Erreur')
      setPrestations([])
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="admin-card card">
        <div style={{color:'#dc2626',padding:12}}>
          <strong>Données eBrigade:</strong> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-card card">
      <div>
        <h3 style={{marginTop:0,marginBottom:12}}>Vos gardes eBrigade</h3>
        
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Du"
            style={{flex:1,padding:'8px 12px',border:'1px solid #ccc',borderRadius:4}}
          />
          <input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Au"
            style={{flex:1,padding:'8px 12px',border:'1px solid #ccc',borderRadius:4}}
          />
          <button 
            onClick={loadEBrigadePrestations}
            style={{padding:'8px 16px',background:'#0366d6',color:'white',border:'none',borderRadius:4,cursor:'pointer'}}
          >
            Charger
          </button>
        </div>

        {loading && <div style={{color:'#666',padding:12}}>Chargement...</div>}

        {!loading && prestations.length === 0 && (
          <div style={{color:'#999',padding:12}}>Aucune prestation trouvée pour cette période</div>
        )}

        {!loading && prestations.length > 0 && (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'2px solid #ddd'}}>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Date</th>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Activité</th>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Heure début</th>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Heure fin</th>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Durée (h)</th>
                  <th style={{padding:12,textAlign:'left',fontWeight:600}}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {prestations.map((p) => (
                  <tr key={p.id} style={{borderBottom:'1px solid #eee'}}>
                    <td style={{padding:12}}>{p.date}</td>
                    <td style={{padding:12,fontSize:12}}>{p.activity}</td>
                    <td style={{padding:12}}>{p.startTime}</td>
                    <td style={{padding:12}}>{p.endTime}</td>
                    <td style={{padding:12}}>{p.duration}h</td>
                    <td style={{padding:12}}>{p.personnel?.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
