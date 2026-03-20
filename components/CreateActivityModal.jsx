import React, { useEffect, useState } from 'react'

export default function CreateActivityModal({ open, onClose, onCreate, initial, onUpdate }){
  const [analyticId, setAnalyticId] = useState('')
  const [analytics, setAnalytics] = useState([])
  const [payType, setPayType] = useState('Permanence')
  const [date, setDate] = useState('')
  const [remuInfi, setRemuInfi] = useState('')
  const [remuMed, setRemuMed] = useState('')
  const [error, setError] = useState(null)

  useEffect(()=>{ if(open) loadAnalytics() }, [open])
  useEffect(() => {
    if (initial) {
      setAnalyticId(initial.analytic_id ? String(initial.analytic_id) : (initial.analytic_id === 0 ? '0' : ''))
      setPayType(initial.pay_type || 'Permanence')
      setDate(initial.date || '')
      setRemuInfi(typeof initial.remuneration_infi !== 'undefined' && initial.remuneration_infi !== null ? String(initial.remuneration_infi) : '')
      setRemuMed(typeof initial.remuneration_med !== 'undefined' && initial.remuneration_med !== null ? String(initial.remuneration_med) : '')
      setError(null)
    } else if (!open) {
      // reset when modal closed
      setAnalyticId('')
      setPayType('Permanence')
      setDate('')
      setRemuInfi('')
      setRemuMed('')
      setError(null)
    }
  }, [initial, open])

  async function loadAnalytics(){
    try{
      const r = await fetch('/api/analytics')
      if (!r.ok) throw new Error('failed')
      const d = await r.json()
      setAnalytics(d.items || [])
    }catch(e){ console.error(e) }
  }

  if (!open) return null

  function submit(e){
    e.preventDefault(); setError(null)
    if (!analyticId) { setError('Choisissez une analytique'); return }
    // validate amounts as numbers (allow empty but convert to null)
    const infi = remuInfi === '' ? null : parseFloat(remuInfi.replace(',', '.'))
    const med = remuMed === '' ? null : parseFloat(remuMed.replace(',', '.'))
    if (remuInfi !== '' && (isNaN(infi) || infi < 0)) { setError('Montant rémunération infi invalide'); return }
    if (remuMed !== '' && (isNaN(med) || med < 0)) { setError('Montant rémunération med invalide'); return }

    const selected = analytics.find(a => a.id === Number(analyticId))
    const payload = {
      analytic_id: Number(analyticId),
      analytic_name: selected ? selected.name : '',
      analytic_code: selected ? selected.code : '',
      pay_type: payType,
      date: date || null,
      remuneration_infi: infi,
      remuneration_med: med
    }
    const isEdit = initial && (initial.id || initial.id === 0)
    if (isEdit && typeof onUpdate === 'function') {
      onUpdate(initial.id, payload)
    } else {
      onCreate(payload)
    }
  }

  const isEdit = initial && (initial.id || initial.id === 0)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" style={{backdropFilter:'blur(4px)'}}>
      <div className="modal create-user-modal" style={{maxWidth:'600px',maxHeight:'90vh',overflow:'auto'}}>
        <div className="modal-header" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',color:'white',borderBottomLeftRadius:0,borderBottomRightRadius:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:24}}>⚡</div>
            <div>
              <strong style={{fontSize:18,display:'block'}}>{isEdit ? 'Modifier activité' : 'Créer une activité'}</strong>
              <small style={{opacity:0.9}}>{isEdit ? 'Mettez à jour les informations' : 'Définissez les paramètres'}</small>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer" style={{color:'white',fontSize:28}}>×</button>
        </div>
        <div className="modal-body" style={{padding:'24px'}}>
          <form className="create-user-form" onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* Section: Analytique */}
            <div style={{borderLeft:'3px solid #10b981',paddingLeft:16}}>
              <label style={{display:'block',marginBottom:12}}>
                <strong style={{display:'block',marginBottom:4,color:'#1f2937',fontSize:14}}>📊 Analytique</strong>
                <select 
                  value={analyticId} 
                  onChange={e=>setAnalyticId(e.target.value)} 
                  required
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                >
                  <option value="">-- Choisir une analytique --</option>
                  {analytics.map(a => <option key={a.id} value={a.id}>{a.name} — {a.code}</option>)}
                </select>
              </label>
            </div>

            {/* Section: Rémunération */}
            <div style={{borderLeft:'3px solid #f59e0b',paddingLeft:16}}>
              <strong style={{display:'block',marginBottom:12,color:'#1f2937',fontSize:14}}>💰 Rémunération</strong>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Type</small>
                  <select 
                    value={payType} 
                    onChange={e=>setPayType(e.target.value)}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  >
                    <option value="Permanence">Permanence</option>
                    <option value="APS">APS</option>
                    <option value="Garde">Garde</option>
                  </select>
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Date</small>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e=>setDate(e.target.value)}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Rémunération Infirmier·ère</small>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={remuInfi} 
                    onChange={e=>setRemuInfi(e.target.value)} 
                    placeholder="45.00"
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Rémunération Médecin</small>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={remuMed} 
                    onChange={e=>setRemuMed(e.target.value)} 
                    placeholder="120.00"
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
            </div>

            {error && (
              <div style={{padding:12,background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',borderRadius:6,fontSize:13}}>
                <strong>❌ Erreur :</strong> {error}
              </div>
            )}

            {/* Actions */}
            <div style={{display:'flex',gap:12,justifyContent:'flex-end',paddingTop:12,borderTop:'1px solid #e5e7eb'}}>
              <button 
                type="button" 
                onClick={onClose}
                style={{padding:'10px 20px',background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
                onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
              >
                Annuler
              </button>
              <button 
                className="primary" 
                type="submit"
                style={{padding:'10px 24px',background:'#10b981',color:'white',border:'none',borderRadius:6,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
                onMouseEnter={(e) => e.target.style.background = '#059669'}
                onMouseLeave={(e) => e.target.style.background = '#10b981'}
              >
                {isEdit ? '💾 Enregistrer' : '✨ Créer activité'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
