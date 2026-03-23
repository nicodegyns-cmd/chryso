import React, { useEffect, useState } from 'react'

export default function ActivitiesCards({ email, onEditActivity }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!email) { setActivities([]); setLoading(false); return }
    
    setLoading(true)
    setError(null)
    
    fetch(`/api/activities?email=${encodeURIComponent(email)}`)
      .then(r => { if (!r.ok) throw new Error(`Échec: ${r.status}`); return r.json() })
      .then(d => {
        console.log('[ActivitiesCards] Received:', d)
        setActivities(d.activities || [])
      })
      .catch(e => {
        console.error('[ActivitiesCards] Error:', e)
        setError(e.message || 'Erreur')
      })
      .finally(() => setLoading(false))
  }, [email])

  if (loading) return (
    <div className="card" style={{display:'flex',flexDirection:'column',gap:8}}>
      <h3>Activités disponibles</h3>
      <div className="small-muted">Chargement…</div>
    </div>
  )

  if (error) return (
    <div className="card" style={{display:'flex',flexDirection:'column',gap:8}}>
      <h3>Activités disponibles</h3>
      <div className="small-muted">Erreur: {error}</div>
    </div>
  )

  return (
    <div className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
      <div>
        <h3 style={{margin:'0 0 4px 0'}}>Activités disponibles</h3>
        <div className="small-muted">Cliquez sur une carte pour déclarer vos heures</div>
      </div>

      {activities.length === 0 ? (
        <div className="small-muted">Aucune activité disponible pour le moment.</div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:12}}>
          {activities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => onEditActivity && onEditActivity(activity)}
              style={{
                background:'#fff',
                border:'2px solid #e5e7eb',
                borderRadius:12,
                padding:16,
                cursor:'pointer',
                transition:'all 0.3s ease',
                display:'flex',
                flexDirection:'column',
                gap:12,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0366d6'
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(3, 102, 214, 0.15)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Header: Date et Type */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                <div>
                  <div style={{fontSize:14,color:'#6b7280',fontWeight:600}}>DATE</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#1f2937'}}>
                    {activity.date ? new Date(activity.date).toLocaleDateString('fr-FR', {weekday:'short', month:'short', day:'numeric'}) : '—'}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,color:'#6b7280',fontWeight:600}}>TYPE</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#0366d6',background:'#eff6ff',padding:'4px 8px',borderRadius:6,whiteSpace:'nowrap'}}>
                    {activity.pay_type || '—'}
                  </div>
                </div>
              </div>

              {/* Analytique et Code */}
              <div>
                <div style={{fontSize:12,color:'#6b7280',fontWeight:600,marginBottom:4}}>ANALYTIQUE</div>
                <div style={{fontSize:14,fontWeight:600,color:'#1f2937'}}>
                  {activity.analytic_name || activity.analytic_code || '—'}
                </div>
                {activity.analytic_code && activity.analytic_code !== activity.analytic_name && (
                  <div style={{fontSize:12,color:'#9ca3af'}}>{activity.analytic_code}</div>
                )}
              </div>

              {/* Rémunérations */}
              {(activity.remuneration_infi || activity.remuneration_med) && (
                <div style={{padding:12,background:'#f0fdf4',borderRadius:8,border:'1px solid #bbf7d0'}}>
                  <div style={{fontSize:11,color:'#15803d',fontWeight:600,marginBottom:6}}>💰 TAUX HORAIRES</div>
                  <div style={{display:'flex',gap:12}}>
                    {activity.remuneration_infi && (
                      <div>
                        <div style={{fontSize:11,color:'#6b7280'}}>Infirmier</div>
                        <div style={{fontSize:13,fontWeight:700,color:'#15803d'}}>{activity.remuneration_infi}€/h</div>
                      </div>
                    )}
                    {activity.remuneration_med && (
                      <div>
                        <div style={{fontSize:11,color:'#6b7280'}}>Médecin</div>
                        <div style={{fontSize:13,fontWeight:700,color:'#15803d'}}>{activity.remuneration_med}€/h</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <button
                style={{
                  width:'100%',
                  padding:'10px 16px',
                  background:'#0366d6',
                  color:'#fff',
                  border:'none',
                  borderRadius:8,
                  fontWeight:600,
                  fontSize:14,
                  cursor:'pointer',
                  transition:'background 0.2s',
                  marginTop:'auto'
                }}
                onMouseEnter={(e) => e.target.style.background = '#0260c8'}
                onMouseLeave={(e) => e.target.style.background = '#0366d6'}
              >
                ✏️ Déclarer mes heures
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
