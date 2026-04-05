import React, { useEffect, useState, useMemo } from 'react'

export default function GenerateSendTable(){
  const [allAnalytics, setAllAnalytics] = useState([])
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState({})
  const [sendHistory, setSendHistory] = useState({})
  const [loadingHistory, setLoadingHistory] = useState({})

  useEffect(()=>{ 
    fetchAllAnalytics()
    fetchPrestations() 
  }, [])

  async function fetchAllAnalytics(){
    try{
      const r = await fetch('/api/analytics')
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setAllAnalytics(d.items || [])
    }catch(e){ console.error('fetchAllAnalytics error:', e) }
  }

  async function fetchPrestations(){
    setLoading(true)
    try{
      const r = await fetch('/api/admin/prestations')
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      // Filter only prestations that have a generated PDF and haven't been sent yet
      const withPdf = (d.items || []).filter(p => p.pdf_url && p.pdf_url.trim() !== '' && !p.sent_in_batch_id)
      console.log('All prestations:', d.items?.length, 'With unsent PDF:', withPdf.length)
      setPrestations(withPdf)
    }catch(e){ console.error('fetchPrestations error:', e) }
    setLoading(false)
  }

  // Group prestations by analytic_id and merge with all analytics
  const analyticGroups = useMemo(() => {
    const groups = {}
    
    // Start with all analytics
    allAnalytics.forEach(a => {
      groups[a.id] = {
        id: a.id,
        name: a.name || `Analytique ${a.id}`,
        code: a.code || '',
        count: 0,
        prestations: []
      }
    })
    
    // Create a group for prestations without analytic_id
    groups['__orphan__'] = {
      id: '__orphan__',
      name: '⚠️ Sans analytique',
      code: 'ORPHAN',
      count: 0,
      prestations: []
    }
    
    // Add prestation counts
    prestations.forEach(p => {
      const analyticId = p.analytic_id || '__orphan__'
      if (groups[analyticId]) {
        groups[analyticId].count += 1
        groups[analyticId].prestations.push(p)
      }
    })
    
    const result = Object.values(groups).sort((a, b) => {
      // Put orphan group last
      if (a.id === '__orphan__') return 1
      if (b.id === '__orphan__') return -1
      return (a.code || a.name).localeCompare(b.code || b.name)
    })
    
    // Load history for each analytic
    result.forEach(analytic => {
      if (!sendHistory[analytic.id]) {
        fetchSendHistory(analytic.id)
      }
    })
    return result
  }, [allAnalytics, prestations, sendHistory])

  async function fetchSendHistory(analyticId){
    if (loadingHistory[analyticId]) return
    setLoadingHistory(prev => ({...prev, [analyticId]: true}))
    try{
      const r = await fetch(`/api/admin/analytics/${analyticId}/get-send-history`)
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setSendHistory(prev => ({...prev, [analyticId]: d.items || []}))
    }catch(e){ console.error('fetchSendHistory error:', e) }
    finally{ setLoadingHistory(prev => { const c = {...prev}; delete c[analyticId]; return c }) }
  }

  async function handleSendInvoices(analyticId){
    if (sending[analyticId]) return
    setSending(prev => ({...prev, [analyticId]: true}))
    try{
      const r = await fetch(`/api/admin/analytics/${analyticId}/send-merged-pdfs`, { method: 'POST' })
      if (!r.ok) {
        const err = await r.text()
        throw new Error(err || 'send failed')
      }
      const data = await r.json()
      alert(`✅ Factures mergées et envoyées avec succès à ${data.recipients?.length || 0} destinataire(s)`)
      // Refresh prestations list and history
      await fetchPrestations()
      await fetchSendHistory(analyticId)
    }catch(e){ 
      console.error('Send error:', e)
      alert('❌ Erreur lors de l\'envoi : ' + e.message) 
    }
    finally{ setSending(prev => { const c = {...prev}; delete c[analyticId]; return c }) }
  }

  return (
    <div>
      <div style={{marginBottom:20}}>
        <p style={{color:'#666',fontSize:14}}>
          Les analytiques ci-dessous ont des factures prêtes à envoyer. Cliquez sur le bouton pour générer et envoyer un PDF combiné avec toutes les factures aux destinataires configurés.
        </p>
      </div>

      {loading ? (
        <div className="small-muted">Chargement des analytiques...</div>
      ) : analyticGroups.length === 0 ? (
        <div style={{padding:20,background:'#f9fafb',borderRadius:8,color:'#666',textAlign:'center'}}>
          Aucune analytique disponible.
        </div>
      ) : (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16,marginBottom:32}}>
            {analyticGroups.map(analytic => (
              <div 
                key={analytic.id}
                style={{
                  padding:16,
                  border:'1px solid #e5e7eb',
                  borderRadius:8,
                  background:'#fff',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                  transition:'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                <div style={{marginBottom:12}}>
                  <h3 style={{margin:'0 0 6px 0',fontSize:16,fontWeight:600,color:'#1f2937'}}>
                    {analytic.code ? `[${analytic.code}]` : ''} {analytic.name}
                  </h3>
                  <div style={{fontSize:13,color:'#6b7280'}}>
                    {analytic.count} facture{analytic.count !== 1 ? 's' : ''} à envoyer
                  </div>
                </div>
                <button
                  onClick={() => handleSendInvoices(analytic.id)}
                  disabled={!!sending[analytic.id] || analytic.count === 0 || analytic.id === '__orphan__'}
                  style={{
                    width:'100%',
                    padding:'10px 16px',
                    background:(sending[analytic.id] || analytic.count === 0 || analytic.id === '__orphan__') ? '#d1d5db' : '#10b981',
                    color:'#fff',
                    border:'none',
                    borderRadius:6,
                    fontSize:14,
                    fontWeight:600,
                    cursor:(sending[analytic.id] || analytic.count === 0 || analytic.id === '__orphan__') ? 'not-allowed' : 'pointer',
                    transition:'background 0.2s',
                    opacity:(sending[analytic.id] || analytic.count === 0 || analytic.id === '__orphan__') ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!sending[analytic.id] && analytic.count > 0 && analytic.id !== '__orphan__') {
                      e.currentTarget.style.background = '#059669'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!sending[analytic.id] && analytic.count > 0 && analytic.id !== '__orphan__') {
                      e.currentTarget.style.background = '#10b981'
                    }
                  }}
                  title={analytic.id === '__orphan__' ? 'Assigner une analytique à ces factures avant envoi' : ''}
                >
                  {sending[analytic.id] ? '📧 Envoi en cours...' : analytic.count === 0 ? '0 facture à envoyer' : analytic.id === '__orphan__' ? '⚠️ Assigner analytique' : '📧 Envoyer les factures'}
                </button>
              </div>
            ))}
          </div>

          {/* History section */}
          <div style={{marginTop:32,borderTop:'2px solid #e5e7eb',paddingTop:24}}>
            <h2 style={{fontSize:18,fontWeight:700,marginBottom:16,color:'#1f2937'}}>📋 Historique des envois</h2>
            
            {analyticGroups.length === 0 ? (
              <div style={{padding:16,background:'#f9fafb',borderRadius:8,color:'#666',textAlign:'center'}}>
                Aucun historique d'envoi.
              </div>
            ) : (
              <div style={{display:'grid',gap:16}}>
                {analyticGroups.map(analytic => {
                  const history = sendHistory[analytic.id] || []
                  return (
                    <div key={`history-${analytic.id}`} style={{background:'#f9fafb',borderRadius:8,padding:16,border:'1px solid #e5e7eb'}}>
                      <h4 style={{margin:'0 0 12px 0',color:'#1f2937',fontWeight:600}}>
                        {analytic.code ? `[${analytic.code}]` : ''} {analytic.name}
                      </h4>
                      
                      {history.length === 0 ? (
                        <div style={{fontSize:13,color:'#6b7280'}}>Aucun envoi enregistré pour cette analytique.</div>
                      ) : (
                        <div style={{display:'grid',gap:8}}>
                          {history.map((send, idx) => (
                            <div key={send.id || idx} style={{
                              padding:12,
                              background:'#fff',
                              borderRadius:6,
                              border:'1px solid #d1d5db',
                              fontSize:13,
                              display:'flex',
                              justifyContent:'space-between',
                              alignItems:'start',
                              gap:12
                            }}>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600,color:'#1f2937',marginBottom:4}}>
                                  📅 {new Date(send.sent_at).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                                </div>
                                <div style={{color:'#6b7280',marginBottom:4}}>
                                  <strong>Documents :</strong> {send.prestation_count} facture{send.prestation_count !== 1 ? 's' : ''}
                                </div>
                                <div style={{color:'#6b7280',marginBottom:4}}>
                                  <strong>Période :</strong> {send.first_prestation_date ? `Du ${new Date(send.first_prestation_date).toLocaleDateString('fr-FR')} au ${new Date(send.last_prestation_date).toLocaleDateString('fr-FR')}` : 'N/A'}
                                </div>
                                <div style={{color:'#6b7280'}}>
                                  <strong>Destinataires :</strong> {(send.recipient_emails || []).join(', ') || 'Aucun'}
                                </div>
                              </div>
                              <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                                <div style={{
                                  padding:'4px 8px',
                                  borderRadius:4,
                                  fontSize:12,
                                  fontWeight:600,
                                  background:send.status === 'success' ? '#dcfce7' : '#fee2e2',
                                  color:send.status === 'success' ? '#166534' : '#991b1b',
                                  whiteSpace:'nowrap'
                                }}>
                                  {send.status === 'success' ? '✅ Succès' : send.status === 'partial' ? '⚠️ Partiel' : '❌ Erreur'}
                                </div>
                                {send.filename && (
                                  <a 
                                    href={send.filename}
                                    download
                                    style={{
                                      padding:'6px 12px',
                                      background:'#0366d6',
                                      color:'#fff',
                                      textDecoration:'none',
                                      borderRadius:4,
                                      fontSize:12,
                                      fontWeight:600,
                                      cursor:'pointer',
                                      whiteSpace:'nowrap',
                                      transition:'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#0256be'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#0366d6'}
                                  >
                                    📥 Télécharger
                                  </a>
                                )}
                              </div>
                              {send.error_message && (
                                <div style={{marginTop:8,padding:8,background:'#fee2e2',borderRadius:4,color:'#991b1b',fontSize:12,width:'100%'}}>
                                  <strong>Erreur :</strong> {send.error_message}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
