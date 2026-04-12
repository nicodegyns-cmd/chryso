import React, { useState, useEffect } from 'react'

export default function CreateAnalyticModal({ open, onClose, onCreate, initial, onUpdate }){
  const [name, setName] = useState('')
  const [analytic, setAnalytic] = useState('PDF')
  const [code, setCode] = useState('')
  const [entite, setEntite] = useState('')
  const [distribution, setDistribution] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initial) {
      setName(initial.name || '')
      setAnalytic(initial.analytic || initial.analytic_type || 'PDF')
      setCode(initial.code || '')
      setEntite(initial.entite || initial.entity || '')
      const dist = initial.distribution || ''
      setDistribution(Array.isArray(dist) ? dist.join('; ') : (typeof dist === 'string' ? dist : ''))
      setAccountNumber(initial.account_number || '')
      setError(null)
    } else {
      setName('')
      setAnalytic('PDF')
      setCode('')
      setEntite('')
      setDistribution('')
      setAccountNumber('')
      setError(null)
    }
  }, [initial])

  if(!open) return null

  function submit(e){
    e.preventDefault()
    setError(null)
    const trimmed = (code || '').trim()
    const ok = /^[A-Za-z0-9_-]+$/.test(trimmed)
    if (!ok) {
      setError('Le code doit contenir uniquement des lettres, chiffres, tirets ou underscores (A-Z, 0-9, - , _).')
      return
    }
    const normalizedCode = trimmed.toUpperCase()

    const distList = (distribution || '')
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean)

    const payload = { name, analytic, code: normalizedCode, entite, distribution: distList, account_number: accountNumber.trim() || null }
    if (isEdit) {
      const id = initial && (initial.id || initial.id === 0) ? initial.id : null
      if (id && typeof onUpdate === 'function') {
        onUpdate(id, payload)
      } else if (id && typeof onCreate === 'function') {
        // fallback: include id in payload
        onCreate({ id, ...payload })
      }
    } else {
      onCreate(payload)
    }
  }

  const isEdit = initial && (initial.id || initial.id === 0)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" style={{backdropFilter:'blur(4px)'}}>
      <div className="modal create-user-modal" style={{maxWidth:'600px',maxHeight:'90vh',overflow:'auto'}}>
        <div className="modal-header" style={{background:'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',color:'white',borderBottomLeftRadius:0,borderBottomRightRadius:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>  
            <div style={{fontSize:24}}>📊</div>
            <div>
              <strong style={{fontSize:18,display:'block'}}>{isEdit ? 'Modifier analytique' : 'Créer une analytique'}</strong>
              <small style={{opacity:0.9}}>{isEdit ? 'Mettez à jour les informations' : 'Définissez les paramètres'}</small>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer" style={{color:'white',fontSize:28}}>×</button>
        </div>
        <div className="modal-body" style={{padding:'24px'}}>
          <form onSubmit={submit} className="create-user-form" noValidate style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* Section: Informations générales */}
            <div style={{borderLeft:'3px solid #8b5cf6',paddingLeft:16}}>
              <label style={{display:'block',marginBottom:12}}>
                <strong style={{display:'block',marginBottom:4,color:'#1f2937',fontSize:14}}>📝 Nom</strong>
                <input 
                  value={name} 
                  onChange={(e)=>setName(e.target.value)} 
                  required
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                />
              </label>
            </div>

            {/* Section: Type et code */}
            <div style={{borderLeft:'3px solid #06b6d4',paddingLeft:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Analytique</small>
                  <input 
                    value={analytic} 
                    onChange={(e)=>setAnalytic(e.target.value)}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Code</small>
                  <input 
                    value={code} 
                    onChange={(e)=>setCode(e.target.value)} 
                    placeholder="Ex: RPT-001"
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
              <label style={{display:'block'}}>
                <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Entité</small>
                <input 
                  value={entite} 
                  onChange={(e)=>setEntite(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                />
              </label>
              <label style={{display:'block',marginTop:12}}>
                <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>N° de compte</small>
                <input 
                  value={accountNumber} 
                  onChange={(e)=>setAccountNumber(e.target.value)}
                  placeholder="Ex: 723033/MED"
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,fontFamily:'monospace'}}
                />
                <small style={{display:'block',marginTop:4,color:'#9ca3af',fontSize:11}}>Référence qui apparaîtra dans la facture (champ "Compte" en haut à droite)</small>
              </label>
            </div>

            {/* Section: Distribution */}
            <div style={{borderLeft:'3px solid #ec4899',paddingLeft:16}}>
              <label style={{display:'block'}}>
                <strong style={{display:'block',marginBottom:4,color:'#1f2937',fontSize:14}}>📧 Distribution</strong>
                <textarea 
                  rows={5} 
                  value={distribution} 
                  onChange={(e)=>setDistribution(e.target.value)} 
                  placeholder="adresse1@exemple.com; adresse2@exemple.com\nOu séparez par des virgules ou points-virgules"
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,fontFamily:'monospace'}}
                />
                <small style={{display:'block',marginTop:6,color:'#6b7280',fontSize:12}}>Saisissez une ou plusieurs adresses séparées par des virgules, points-virgules ou retours à la ligne.</small>
              </label>
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
                style={{padding:'10px 24px',background:'#8b5cf6',color:'white',border:'none',borderRadius:6,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
                onMouseEnter={(e) => e.target.style.background = '#7c3aed'}
                onMouseLeave={(e) => e.target.style.background = '#8b5cf6'}
              >
                {isEdit ? '💾 Enregistrer' : '✨ Créer analytique'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
