import React, { useState, useRef, useEffect } from 'react'

function fmtNiss(v) {
  const d = (v||'').replace(/\D/g,'').slice(0,11)
  if (d.length<=2) return d
  if (d.length<=4) return d.slice(0,2)+'.'+d.slice(2)
  if (d.length<=6) return d.slice(0,2)+'.'+d.slice(2,4)+'.'+d.slice(4)
  if (d.length<=9) return d.slice(0,2)+'.'+d.slice(2,4)+'.'+d.slice(4,6)+'-'+d.slice(6)
  return d.slice(0,2)+'.'+d.slice(2,4)+'.'+d.slice(4,6)+'-'+d.slice(6,9)+'.'+d.slice(9)
}
function fmtIban(v) {
  let c = (v||'').replace(/\s/g,'').toUpperCase()
  if (!c.startsWith('BE')) c = 'BE'+c.replace(/[^A-Z0-9]/g,'')
  const m = c.slice(0,16).match(/.{1,4}/g)
  return m ? m.join(' ') : c
}
function parseAdresse(v) {
  if (!v) return { adresseNum: '', adresseRue: '', adresseCP: '', adresseVille: '' }
  const m1 = v.match(/^(\d+[a-zA-Z]?)\s+(.+?),\s*(\d{4,5})\s+(.+)$/)
  if (m1) return { adresseNum: m1[1], adresseRue: m1[2], adresseCP: m1[3], adresseVille: m1[4] }
  const m2 = v.match(/^(.+?),\s*(\d{4,5})\s+(.+)$/)
  if (m2) return { adresseNum: '', adresseRue: m2[1], adresseCP: m2[2], adresseVille: m2[3] }
  return { adresseNum: '', adresseRue: v, adresseCP: '', adresseVille: '' }
}
function buildAdresse({ adresseNum, adresseRue, adresseCP, adresseVille }) {
  const rue = [adresseNum, adresseRue].filter(Boolean).join(' ')
  const loc = [adresseCP, adresseVille].filter(Boolean).join(' ')
  return [rue, loc].filter(Boolean).join(', ')
}

export default function CreateUserModal({ open, onClose, onCreate, initial }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(['INFI'])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ninami, setNinami] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresseNum, setAdresseNum] = useState('')
  const [adresseRue, setAdresseRue] = useState('')
  const [adresseCP, setAdresseCP] = useState('')
  const [adresseVille, setAdresseVille] = useState('')
  const [niss, setNiss] = useState('')
  const [bce, setBce] = useState('')
  const [societe, setSociete] = useState('')
  const [compte, setCompte] = useState('')
  const [liaisonOptions, setLiaisonOptions] = useState([])
  const [liaisonId, setLiaisonId] = useState('none')
  const [liaisonQuery, setLiaisonQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const searchTimer = useRef(null)
  const [hasLoadedOnOpen, setHasLoadedOnOpen] = useState(false)
  const [fonction, setFonction] = useState('')

  const [moderatorAnalyticIds, setModeratorAnalyticIds] = useState([])
  const [analyticsList, setAnalyticsList] = useState([])

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [linkingEbrigade, setLinkingEbrigade] = useState(false)
  const [ebrigadeLinked, setEbrigadeLinked] = useState(false)

  // Fetch analytics list once on mount
  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setAnalyticsList(d.items || d.analytics || []))
      .catch(() => {})
  }, [])

  // fetch suggestions when liaisonQuery changes (debounced)
  useEffect(() => {
    if (!liaisonQuery || liaisonQuery.length < 2) {
      setLiaisonOptions([])
      setSearchLoading(false)
      setSearchError(null)
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true)
      setSearchError(null)
      try {
        if (!liaisonQuery || liaisonQuery.trim() === '') {
          setLiaisonOptions([])
          return
        }
        const resp = await fetch('/api/admin/users/ebrigade-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastname: liaisonQuery, qstrict: '0' })
        })
        if (!resp.ok) {
          const errText = await resp.text()
          setSearchError(`Erreur ${resp.status}: ${errText.substring(0, 100)}`)
          setLiaisonOptions([])
          return
        }
        const data = await resp.json()
        // expect proxy to return { remote: [...] } or similar
        const items = (data && data.remote && Array.isArray(data.remote)) ? data.remote : (Array.isArray(data) ? data : [])
        // map items to { id, label } - use firstname+lastname for label
        const opts = items.map((it) => ({ 
          id: String(it.id || it.ebrigade_id || it.EBR_ID || it.code || '').trim(), 
          label: `${it.firstname || ''} ${it.lastname || ''}`.trim() || `${it.id || it.ebrigade_id}`
        }))
        setLiaisonOptions(opts.filter(o => o.id))
      } catch (err) {
        setSearchError(err.message || 'Erreur recherche')
        setLiaisonOptions([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [liaisonQuery])

  // Fetch profiles explicitly (e.g. when opening the dropdown)
  async function fetchProfiles(forceQuery) {
    try {
      setSearchLoading(true)
      setSearchError(null)
      if (!forceQuery || forceQuery.trim() === '') {
        setLiaisonOptions([])
        return
      }
      const resp = await fetch('/api/admin/users/ebrigade-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastname: forceQuery || '', qstrict: '0' })
      })
      if (!resp.ok) {
        const errText = await resp.text()
        setSearchError(`Erreur ${resp.status}: ${errText.substring(0, 100)}`)
        setLiaisonOptions([])
        return
      }
      const data = await resp.json()
      const items = (data && data.remote && Array.isArray(data.remote)) ? data.remote : (Array.isArray(data) ? data : [])
      const opts = items.map((it) => ({ 
        id: String(it.id || it.ebrigade_id || it.EBR_ID || it.code || '').trim(), 
        label: `${it.firstname || ''} ${it.lastname || ''}`.trim() || `${it.id || it.ebrigade_id}`
      }))
      setLiaisonOptions(opts.filter(o => o.id))
    } catch (err) {
      setSearchError(err.message || 'Erreur recherche')
      setLiaisonOptions([])
    } finally {
      setSearchLoading(false)
      setHasLoadedOnOpen(true)
    }
  }

  // when `initial` changes (edit), populate fields
  React.useEffect(() => {
    setEmailSent(false) // Reset email sent state
    if (initial) {
      setEmail(initial.email || '')
      const roleRaw = initial.role || initial.roleValue || ''
      let r = ['INFI']
      if (roleRaw) {
        if (Array.isArray(roleRaw)) r = roleRaw.map(String)
        else if (typeof roleRaw === 'string') r = roleRaw.split(',').map(s => s.trim()).filter(Boolean)
      }
      setRole(r.length ? r : ['INFI'])
      setFirstName(initial.first_name || initial.firstName || '')
      setLastName(initial.last_name || initial.lastName || '')
      setNinami(initial.ninami || '')
      setTelephone(initial.telephone || '')
      const parsedA = parseAdresse(initial.address || initial.adresse || '')
      setAdresseNum(parsedA.adresseNum)
      setAdresseRue(parsedA.adresseRue)
      setAdresseCP(parsedA.adresseCP)
      setAdresseVille(parsedA.adresseVille)
      setNiss(initial.niss || '')
      setBce(initial.bce || '')
      setSociete(initial.company || initial.societe || '')
      setCompte(initial.account || initial.compte || '')
      setLiaisonId(initial.liaison_ebrigade_id || initial.liaisonId || 'none')
      setFonction(initial.fonction || initial.fonction || '')
      const ids = initial.moderator_analytic_ids
      if (ids) {
        setModeratorAnalyticIds(typeof ids === 'string' ? ids.split(',').map(s => s.trim()).filter(Boolean) : ids)
      } else {
        setModeratorAnalyticIds([])
      }
    } else {
      // reset when creating new
      setEmail('')
      setRole(['user'])
      setFirstName('')
      setLastName('')
      setNinami('')
      setTelephone('')
      setAdresseNum('')
      setAdresseRue('')
      setAdresseCP('')
      setAdresseVille('')
      setNiss('')
      setBce('')
      setSociete('')
      setCompte('')
      setLiaisonId('none')
      setFonction('')
      setModeratorAnalyticIds([])
    }
  }, [initial])

  if (!open) return null

  function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const isModerator = Array.isArray(role) ? role.includes('moderator') : role === 'moderator'
    const payload = {
      email,
      role,
      firstName,
      lastName,
      ninami,
      telephone,
      adresse: buildAdresse({ adresseNum, adresseRue, adresseCP, adresseVille }),
      niss,
      bce,
      societe,
      compte,
      fonction,
      liaisonId: liaisonId === 'none' ? null : liaisonId,
      moderatorAnalyticIds: isModerator && moderatorAnalyticIds.length > 0 ? moderatorAnalyticIds.join(',') : null,
    }

    // `onCreate` should return a Promise from the parent
    Promise.resolve(onCreate(payload, initial && initial.id ? initial.id : undefined))
      .then(() => {
        setSuccess(true)
        setLoading(false)
        // small delay so user sees success, then close
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 900)
      })
      .catch((err) => {
        setError(err && err.message ? err.message : 'Erreur')
        setLoading(false)
      })
  }
  function handleLiaisonSelect(id, label) {
    setLiaisonId(id || 'none')
    setLiaisonQuery(label || id || '')
  }

  async function handleResendWelcomeEmail() {
    if (!initial || !initial.id) return

    setResendingEmail(true)
    try {
      const r = await fetch(`/api/admin/users/${initial.id}/resend-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }
      const data = await r.json()
      setEmailSent(true)
      // Reset after 2 seconds
      setTimeout(() => setEmailSent(false), 2000)
    } catch (err) {
      alert('Erreur: ' + (err.message || 'Impossible d\'envoyer l\'email'))
    } finally {
      setResendingEmail(false)
    }
  }

  async function handleLinkEbrigade() {
    if (!initial || !initial.id) return
    if (liaisonId === 'none' || !liaisonId) return

    setLinkingEbrigade(true)
    try {
      const r = await fetch(`/api/admin/users/${initial.id}/link-liaison-ebrigade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liaison_ebrigade_id: liaisonId })
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error(data.error || 'Erreur lors de la liaison')
      }
      const data = await r.json()
      setEbrigadeLinked(true)
      setTimeout(() => setEbrigadeLinked(false), 2000)
    } catch (err) {
      alert('Erreur: ' + (err.message || 'Impossible de lier le profil eBrigade'))
    } finally {
      setLinkingEbrigade(false)
    }
  }

  const isEdit = initial && (initial.id || initial.id === 0)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" style={{backdropFilter:'blur(4px)'}}>
      <div className="modal create-user-modal" style={{maxWidth:'600px',maxHeight:'90vh',overflow:'auto'}}>
        <div className="modal-header" style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',color:'white',borderBottomLeftRadius:0,borderBottomRightRadius:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:24}}>👤</div>
            <div>
              <strong style={{fontSize:18,display:'block'}}>{isEdit ? 'Modifier utilisateur' : 'Créer un utilisateur'}</strong>
              <small style={{opacity:0.9}}>{isEdit ? 'Mettez à jour les informations' : 'Nouveau collaborateur'}</small>
            </div>
            {loading && <span style={{marginLeft:'auto',fontSize:12,background:'rgba(255,255,255,0.3)',padding:'4px 8px',borderRadius:4}}>⏳ Envoi…</span>}
            {success && <span style={{marginLeft:'auto',fontSize:12,background:'#10b981',padding:'4px 8px',borderRadius:4}}>✅ {isEdit ? 'Enregistré' : 'Créé'}</span>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer" style={{color:'white',fontSize:28}}>×</button>
        </div>

        <div className="modal-body" style={{padding:'24px'}}>
          <form className="create-user-form" onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:24}}>
            
            {/* Section: Login */}
            <div style={{borderLeft:'3px solid #667eea',paddingLeft:16}}>
              <label style={{display:'block',marginBottom:12}}>
                <strong style={{display:'block',marginBottom:4,color:'#1f2937',fontSize:14}}>📧 Email (Identifiant)</strong>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                />
              </label>
            </div>

            {/* Section: Liaison eBrigade */}
            <div style={{borderLeft:'3px solid #10b981',paddingLeft:16}}>
              <strong style={{display:'block',marginBottom:12,color:'#1f2937',fontSize:14}}>🔗 Liaison eBrigade</strong>
              
              {/* Show current link if editing existing user */}
              {isEdit && initial && initial.liaison_ebrigade_id && (
                <div style={{
                  marginBottom: 12,
                  padding: 10,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#065f46'
                }}>
                  ✅ Lié à: <strong>{initial.liaison_ebrigade_id}</strong>
                </div>
              )}
              
              <input
                placeholder="Rechercher dans eBrigade (nom, prénom...)"
                value={liaisonQuery}
                onChange={(e) => { setLiaisonQuery(e.target.value); if (e.target.value === '') setLiaisonId('none') }}
                onFocus={() => { if (!hasLoadedOnOpen && !liaisonOptions.length) fetchProfiles() }}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,marginBottom:8}}
              />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                <button 
                  type="button" 
                  onClick={() => fetchProfiles()} 
                  disabled={searchLoading}
                  style={{padding:'6px 12px',background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,cursor:'pointer'}}
                >
                  {searchLoading ? '⏳ Recherche...' : 'Charger profils'}
                </button>
                {isEdit && (
                  <button 
                    type="button" 
                    onClick={handleLinkEbrigade} 
                    disabled={linkingEbrigade || liaisonId === 'none' || !liaisonId}
                    style={{
                      padding: '6px 12px',
                      background: ebrigadeLinked ? '#86efac' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      opacity: (linkingEbrigade || liaisonId === 'none' || !liaisonId) ? 0.5 : 1
                    }}
                  >
                    {ebrigadeLinked ? '✅ Lié!' : (linkingEbrigade ? '⏳ Liaison...' : '🔗 Lier')}
                  </button>
                )}
              </div>
              {searchError && <div style={{marginTop:8,padding:8,background:'#fee2e2',color:'#991b1b',borderRadius:4,fontSize:12}}>{searchError}</div>}
              {liaisonOptions.length > 0 && (
                <div style={{marginTop:12}}>
                  <label style={{display:'block',marginBottom:6,fontSize:12,color:'#6b7280'}}>Sélectionner un profil</label>
                  <select
                    value={liaisonId === 'none' ? '' : liaisonId}
                    onChange={(e) => handleLiaisonSelect(e.target.value, e.target.selectedOptions[0] && e.target.selectedOptions[0].textContent)}
                    size={Math.min(5, liaisonOptions.length)}
                    style={{width:'100%',padding:'8px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,background:'white'}}
                  >
                    <option value="">-- Choisir un profil --</option>
                    {liaisonOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label || opt.id}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Section: Informations personnelles */}
            <div style={{borderLeft:'3px solid #f59e0b',paddingLeft:16}}>
              <strong style={{display:'block',marginBottom:12,color:'#1f2937',fontSize:14}}>👤 Informations personnelles</strong>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Prénom</small>
                  <input 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    required 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Nom</small>
                  <input 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    required 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Téléphone</small>
                  <input 
                    value={telephone} 
                    onChange={(e) => setTelephone(e.target.value)} 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>N'inami</small>
                  <input 
                    value={ninami} 
                    onChange={(e) => setNinami(e.target.value)} 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
              <div style={{marginTop:12}}>
                <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Adresse</small>
                <div style={{display:'grid',gridTemplateColumns:'80px 1fr 100px 1fr',gap:8}}>
                  <input value={adresseNum} onChange={(e) => setAdresseNum(e.target.value)} placeholder="N°" style={{padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}} />
                  <input value={adresseRue} onChange={(e) => setAdresseRue(e.target.value)} placeholder="Rue / Avenue..." style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                  <input value={adresseCP} onChange={(e) => setAdresseCP(e.target.value)} placeholder="Code postal" style={{padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}} />
                  <input value={adresseVille} onChange={(e) => setAdresseVille(e.target.value)} placeholder="Localité" style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                </div>
              </div>
            </div>

            {/* Section: Informations professionnelles */}
            <div style={{borderLeft:'3px solid #8b5cf6',paddingLeft:16}}>
              <strong style={{display:'block',marginBottom:12,color:'#1f2937',fontSize:14}}>💼 Informations professionnelles</strong>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Société</small>
                  <input 
                    value={societe} 
                    onChange={(e) => setSociete(e.target.value)} 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Fonction</small>
                  <input 
                    value={fonction} 
                    onChange={(e) => setFonction(e.target.value)} 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>NISS</small>
                  <input 
                    value={niss} 
                    onChange={(e) => setNiss(fmtNiss(e.target.value))} 
                    placeholder="94.05.06-421.50"
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>BCE</small>
                  <input 
                    value={bce} 
                    onChange={(e) => setBce(e.target.value)} 
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
                <label style={{display:'block'}}>
                  <small style={{display:'block',marginBottom:4,color:'#6b7280',fontWeight:500}}>Compte</small>
                  <input 
                    value={compte} 
                    onChange={(e) => setCompte(fmtIban(e.target.value))} 
                    placeholder="BE88 0000 0000 0000"
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}
                  />
                </label>
              </div>
            </div>

            {/* Section: Rôles */}
            <div style={{borderLeft:'3px solid #ec4899',paddingLeft:16}}>
              <strong style={{display:'block',marginBottom:12,color:'#1f2937',fontSize:14}}>🔐 Rôles et permissions</strong>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {['INFI','MED','admin','moderator','comptabilite'].map((r) => (
                  <label key={r} style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px',borderRadius:6,transition:'background 0.2s',background:'transparent'}}>
                    <input
                      type="checkbox"
                      value={r}
                      checked={Array.isArray(role) ? role.includes(r) : role === r}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setRole((prev) => {
                          const arr = Array.isArray(prev) ? prev.slice() : [prev]
                          if (checked) {
                            if (!arr.includes(r)) arr.push(r)
                          } else {
                            const idx = arr.indexOf(r)
                            if (idx !== -1) arr.splice(idx, 1)
                          }
                          return arr.length ? arr : []
                        })
                      }}
                      style={{width:18,height:18,cursor:'pointer'}}
                    />
                    <span style={{fontSize:13,color:'#374151'}}>{r === 'comptabilite' ? '💰 Comptabilité' : r}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Section: Analytiques modérateur (visible seulement si rôle moderator coché) */}
            {(Array.isArray(role) ? role.includes('moderator') : role === 'moderator') && (
              <div style={{borderLeft:'3px solid #0ea5e9',paddingLeft:16}}>
                <strong style={{display:'block',marginBottom:8,color:'#1f2937',fontSize:14}}>📊 Analytiques assignées au modérateur</strong>
                <small style={{display:'block',marginBottom:10,color:'#6b7280',fontSize:12}}>
                  Sélectionnez les analytiques locales dont ce modérateur gérera les demandes. Si aucune n'est sélectionnée, il verra toutes les demandes.
                </small>
                {analyticsList.length === 0 ? (
                  <div style={{fontSize:12,color:'#9ca3af'}}>Chargement des analytiques…</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto',padding:'4px 0'}}>
                    {analyticsList.map((a) => {
                      const sid = String(a.id)
                      const checked = moderatorAnalyticIds.includes(sid)
                      return (
                        <label key={a.id} style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',padding:'6px 8px',borderRadius:6,background: checked ? '#e0f2fe' : 'transparent',border: checked ? '1px solid #7dd3fc' : '1px solid transparent',transition:'all 0.15s'}}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setModeratorAnalyticIds(prev => e.target.checked ? [...prev, sid] : prev.filter(x => x !== sid))
                            }}
                            style={{width:16,height:16,cursor:'pointer'}}
                          />
                          <span style={{fontSize:13,color:'#1f2937',fontWeight: checked ? 600 : 400}}>
                            {a.name}{a.code ? <span style={{color:'#6b7280',fontWeight:400}}> ({a.code})</span> : ''}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {moderatorAnalyticIds.length > 0 && (
                  <div style={{marginTop:8,fontSize:12,color:'#0369a1'}}>
                    ✅ {moderatorAnalyticIds.length} analytique(s) sélectionnée(s)
                    <button type="button" onClick={() => setModeratorAnalyticIds([])} style={{marginLeft:8,fontSize:11,color:'#dc2626',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Tout effacer</button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{padding:12,background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',borderRadius:6,fontSize:13}}>
                <strong>❌ Erreur :</strong> {error}
              </div>
            )}

            {/* Actions */}
            <div style={{display:'flex',gap:12,justifyContent:'flex-end',paddingTop:12,borderTop:'1px solid #e5e7eb'}}>
              {isEdit && (
                <button 
                  type="button" 
                  onClick={handleResendWelcomeEmail}
                  disabled={resendingEmail}
                  title="Renvoyer l'email de bienvenue avec un nouveau mot de passe temporaire"
                  style={{padding:'10px 20px',background:emailSent ? '#10b981' : '#f0f9ff',border:'1px solid ' + (emailSent ? '#10b981' : '#7dd3fc'),borderRadius:6,fontSize:14,fontWeight:600,cursor:resendingEmail ? 'not-allowed' : 'pointer',transition:'all 0.2s',color: emailSent ? 'white' : '#0369a1'}}
                  onMouseEnter={(e) => !resendingEmail && !emailSent && (e.target.style.background = '#e0f2fe')}
                  onMouseLeave={(e) => !resendingEmail && !emailSent && (e.target.style.background = '#f0f9ff')}
                >
                  {emailSent ? '✅ Email envoyé' : (resendingEmail ? '⏳ Envoi...' : '📧 Renvoyer email')}
                </button>
              )}
              <button 
                type="button" 
                onClick={onClose} 
                disabled={loading}
                style={{padding:'10px 20px',background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}
                onMouseEnter={(e) => !loading && (e.target.style.background = '#e5e7eb')}
                onMouseLeave={(e) => !loading && (e.target.style.background = '#f3f4f6')}
              >
                Annuler
              </button>
              <button 
                className="primary" 
                type="submit" 
                disabled={loading}
                style={{padding:'10px 24px',background:loading ? '#d1d5db' : '#667eea',color:'white',border:'none',borderRadius:6,fontSize:14,fontWeight:600,cursor:loading ? 'not-allowed' : 'pointer',transition:'all 0.2s'}}
                onMouseEnter={(e) => !loading && (e.target.style.background = '#5568d3')}
                onMouseLeave={(e) => !loading && (e.target.style.background = '#667eea')}
              >
                {loading ? (isEdit ? '⏳ Enregistrement...' : '⏳ Création...') : (isEdit ? '💾 Enregistrer' : '✨ Créer utilisateur')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
