import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'

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
function buildAdresse(f) {
  const rue = [f.adresseNum, f.adresseRue].filter(Boolean).join(' ')
  const loc = [f.adresseCP, f.adresseVille].filter(Boolean).join(' ')
  return [rue, loc].filter(Boolean).join(', ')
}
function isProfileFormValid(form, isMed) {
  // Tous les champs sauf SOCIÉTÉ sont obligatoires
  return !!(
    form.firstName?.trim() &&
    form.lastName?.trim() &&
    form.telephone?.trim() &&
    (!isMed || form.ninami?.trim()) &&
    form.niss?.trim() &&
    form.bce?.trim() &&
    form.compte?.trim() &&
    form.adresseRue?.trim() &&
    form.adresseCP?.trim() &&
    form.adresseVille?.trim()
  )
}

export default function ProfilePage(){
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    telephone: '',
    adresseNum: '',
    adresseRue: '',
    adresseCP: '',
    adresseVille: '',
    fonction: '',
    ninami: '',
    niss: '',
    bce: '',
    societe: '',
    compte: '',
    email: '',
    liaisonId: '',
    acceptedCgu: false,
    acceptedPrivacy: false,
  })
  const [saveError, setSaveError] = useState(null)
  
  // Onboarding flow: 'profile' → 'acceptance' → 'password' → null
  const [onboardingStep, setOnboardingStep] = useState(null)
  
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [completedPasswordChange, setCompletedPasswordChange] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  const [acceptanceError, setAcceptanceError] = useState(null)
  const [acceptanceLoading, setAcceptanceLoading] = useState(false)

  const isMed = !!(user?.role && ['MED', 'medecin'].some(r => user.role.includes(r)))

  useEffect(() => {
    const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    if (!email) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      return
    }

    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
        if (!me) {
          setUser(null)
        } else {
          setUser(me)
          
          setForm({
            firstName: me.first_name || me.firstName || '',
            lastName: me.last_name || me.lastName || '',
            telephone: me.telephone || '',
            ...parseAdresse(me.address || me.adresse || ''),
            fonction: me.fonction || '',
            ninami: me.ninami || '',
            niss: me.niss || '',
            bce: me.bce || '',
            societe: me.company || me.societe || '',
            compte: me.account || me.compte || '',
            email: me.email || '',
            liaisonId: me.liaison_ebrigade_id || '',
            acceptedCgu: !!me.accepted_cgu,
            acceptedPrivacy: !!me.accepted_privacy,
          })
          
          // Priority 1: If account requires completion, start onboarding flow (step 1: profile completion)
          // This takes priority over is_active check (only for INFI/MED roles)
          const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
          const internalMustCompleteRoles = ['moderator', 'comptabilite', 'admin']
          if (me.must_complete_profile && internalMustCompleteRoles.some(r => me.role?.includes(r))) {
            // Internal roles: skip profile/CGU steps, go directly to password change
            setOnboardingStep('password')
          }
          else if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
            setOnboardingStep('profile')
          }
          // Priority 2: If user is not active and onboarding is complete, redirect to pending page
          else if (!me.is_active) {
            router.push('/account-pending')
            return
          }
        }
      } catch (err) {
        console.error('Failed to load profile', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  async function save() {
    try {
      setSaveError(null)

      // Validation OBLIGATOIRE pour tous les saves
      if (!form.firstName?.trim()) { setSaveError('Le prénom est requis'); return }
      if (!form.lastName?.trim()) { setSaveError('Le nom est requis'); return }
      if (!form.telephone?.trim()) { setSaveError('Le téléphone est requis'); return }
      if (isMed && !form.ninami?.trim()) { setSaveError("Le numéro N'INAMI est requis"); return }
      if (!form.niss?.trim() || !form.bce?.trim()) { setSaveError('Le NISS et le numéro BCE sont tous les deux requis'); return }
      if (!form.compte?.trim()) { setSaveError('Le compte bancaire est requis'); return }
      if (!form.adresseRue?.trim() || !form.adresseCP?.trim() || !form.adresseVille?.trim()) { setSaveError("L'adresse complète est requise (rue, code postal, localité)"); return }
      
      const payload = {
        email: user.email,
        firstName: form.firstName,
        lastName: form.lastName,
        telephone: form.telephone,
        adresse: buildAdresse(form),
        fonction: form.fonction,
        ninami: form.ninami,
        niss: form.niss,
        bce: form.bce,
        societe: form.societe,
        compte: form.compte,
        liaisonId: form.liaisonId,
        acceptedCgu: form.acceptedCgu,
        acceptedPrivacy: form.acceptedPrivacy,
      }
      const resp = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const errorData = await resp.json()
        throw new Error(errorData.detail || 'Erreur lors de la mise à jour')
      }
      const body = await resp.json()
      setUser(body.user)
      
      // If in onboarding and just finished profile step, move to acceptance
      if (onboardingStep === 'profile') {
        setOnboardingStep('acceptance')
        setEditing(false)
      } else {
        // Normal profile edit outside onboarding
        setEditing(false)
      }
    } catch (err) {
      console.error('Save profile failed', err)
      setSaveError(err.message || 'Erreur')
    }
  }

  async function savePassword() {
    try {
      setPasswordError(null)
      if (!passwordForm.oldPassword) {
        setPasswordError('Veuillez entrer votre mot de passe actuel')
        return
      }
      if (!passwordForm.newPassword) {
        setPasswordError('Veuillez entrer un nouveau mot de passe')
        return
      }
      if (!passwordForm.confirmPassword) {
        setPasswordError('Veuillez confirmer votre nouveau mot de passe')
        return
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError('Les nouveaux mots de passe ne correspondent pas')
        return
      }
      if (passwordForm.newPassword.length < 6) {
        setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères')
        return
      }
      
      setPasswordLoading(true)
      const resp = await fetch(`/api/admin/users/${user.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error || 'Erreur lors de la modification du mot de passe')
      }
      
      setPasswordSuccess(true)
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setCompletedPasswordChange(true)
      
      // Update user to mark onboarding as complete
      const userResp = await fetch('/api/admin/users')
      const userData = await userResp.json()
      const email = localStorage.getItem('email')
      const updatedUser = (userData.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
      if (updatedUser) {
        setUser(updatedUser)
      }
      
      setTimeout(() => {
        // Onboarding complete - close all modals
        setOnboardingStep(null)
        setPasswordSuccess(false)
        // Redirect internal roles to their dashboard after password change
        const role = localStorage.getItem('role')
        if (role === 'moderator') router.replace('/moderator')
        else if (role === 'comptabilite') router.replace('/comptabilite')
        else if (role === 'admin') router.replace('/admin')
      }, 1500)
    } catch (err) {
      console.error('Save password failed', err)
      setPasswordError(err.message || 'Erreur')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) return <div className="admin-page-root"><AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} /><UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="login-card">Chargement…</div></div>
  if (!user) return <div className="admin-page-root"><AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} /><UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="login-card">Profil introuvable.</div></div>

  // render a responsive profile page with details and edit form
  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        <div className="admin-header">
          <h1>Mon profil</h1>
          <div className="small-muted">Consultez et modifiez vos informations personnelles</div>
        </div>

        <div className="profile-grid">
          <div className="card" style={{padding:16}}>
            <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:20,alignItems:'flex-start'}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <div style={{width:100,height:100,borderRadius:8,background:'linear-gradient(135deg, #2563eb, #3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'#fff',fontWeight:700}}>
                  {((user.first_name||user.firstName||'')[0]||'U').toUpperCase()}{((user.last_name||user.lastName||'')[0]||'')}
                </div>
                <div style={{fontSize:12,color:'#888',textAlign:'center',lineHeight:1.4}}>{user.email}</div>
              </div>
              <div>
                {!editing ? (
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,rowGap:14}}>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>EMAIL</div><div style={{fontSize:15,fontWeight:600,color:'#111'}}>{user.email || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>PRÉNOM</div><div style={{fontSize:15,fontWeight:600,color:'#111'}}>{user.first_name || user.firstName || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>NOM</div><div style={{fontSize:15,fontWeight:600,color:'#111'}}>{user.last_name || user.lastName || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>TÉLÉPHONE</div><div style={{fontSize:14,color:'#222'}}>{user.telephone || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>FONCTION</div><div style={{fontSize:14,color:'#222'}}>{user.fonction || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>N'INAMI</div><div style={{fontSize:14,color:'#222'}}>{user.ninami || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>NISS</div><div style={{fontSize:14,color:'#222'}}>{user.niss || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>BCE</div><div style={{fontSize:14,color:'#222'}}>{user.bce || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>SOCIÉTÉ</div><div style={{fontSize:14,color:'#222'}}>{user.company || user.societe || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>COMPTE</div><div style={{fontSize:14,color:'#222'}}>{user.account || user.compte || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>LIAISON EBRIGADE</div><div style={{fontSize:14,color:'#222'}}>{user.liaison_ebrigade_id || '—'}</div></div>
                      <div><div style={{fontSize:12,color:'#888',marginBottom:4}}>RÔLE</div><div style={{fontSize:14,color:'#222'}}>{Array.isArray(user.role) ? user.role.join(', ') : user.role}</div></div>
                      <div style={{gridColumn:'1 / -1'}}><div style={{fontSize:12,color:'#888',marginBottom:4}}>ADRESSE</div><div style={{fontSize:14,color:'#222'}}>{user.address || user.adresse || '—'}</div></div>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16,gap:8}}>
                      <button className="secondary" onClick={() => setOnboardingStep(onboardingStep ? null : 'password')}>Modifier mon mot de passe</button>
                      <button className="primary" onClick={() => setEditing(true)}>Modifier</button>
                    </div>
                  </div>
                ) : (
                  <form className="create-user-form" onSubmit={(e) => { e.preventDefault(); save() }}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>EMAIL</div>
                        <input value={form.email} disabled style={{opacity:0.6}} />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>PRÉNOM *</div>
                        <input value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>NOM *</div>
                        <input value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>TÉLÉPHONE *</div>
                        <input value={form.telephone} onChange={(e) => setForm({...form, telephone: e.target.value})} required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>N'INAMI {isMed ? '*' : '(optionnel)'}</div>
                        <input value={form.ninami} onChange={(e) => setForm({...form, ninami: e.target.value})} required={isMed} />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>NISS *</div>
                        <input value={form.niss} onChange={(e) => setForm({...form, niss: fmtNiss(e.target.value)})} placeholder="94.05.06-421.50" required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>BCE *</div>
                        <input value={form.bce} onChange={(e) => setForm({...form, bce: e.target.value})} placeholder="Numéro BCE" required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>SOCIÉTÉ (optionnel)</div>
                        <input value={form.societe} onChange={(e) => setForm({...form, societe: e.target.value})} placeholder="Optionnel" />
                        <div style={{fontSize:12,color:'#fff',fontWeight:600,marginTop:6,padding:8,background:'#f97316',borderRadius:4,lineHeight:1.4}}>⚠️ Ne remplir uniquement si vous êtes en société (personne morale)</div>
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>COMPTE BANCAIRE *</div>
                        <input value={form.compte} onChange={(e) => setForm({...form, compte: fmtIban(e.target.value)})} placeholder="BE88 0000 0000 0000" required />
                      </label>
                      <label className="form-row">
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>LIAISON EBRIGADE</div>
                        <input value={form.liaisonId} disabled style={{opacity:0.6}} />
                      </label>
                      <label className="form-row" style={{gridColumn:'1 / -1'}}>
                        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>ADRESSE *</div>
                        <div style={{display:'grid',gridTemplateColumns:'80px 1fr 100px 1fr',gap:8}}>
                          <input value={form.adresseNum} onChange={(e) => setForm({...form, adresseNum: e.target.value})} placeholder="N°" />
                          <input value={form.adresseRue} onChange={(e) => setForm({...form, adresseRue: e.target.value})} placeholder="Rue / Avenue..." required />
                          <input value={form.adresseCP} onChange={(e) => setForm({...form, adresseCP: e.target.value})} placeholder="Code postal" required />
                          <input value={form.adresseVille} onChange={(e) => setForm({...form, adresseVille: e.target.value})} placeholder="Localité" required />
                        </div>
                      </label>
                    </div>
                    {saveError && <div style={{color:'#d32f2f',fontSize:13,marginTop:12}}>{saveError}</div>}
                    <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
                      <button type="button" className="secondary" onClick={() => { setEditing(false); setSaveError(null) }}>Abandonner</button>
                      <button 
                        className="primary" 
                        type="submit"
                        disabled={!isProfileFormValid(form, isMed)}
                        style={{opacity: !isProfileFormValid(form, isMed) ? 0.5 : 1, cursor: !isProfileFormValid(form, isMed) ? 'not-allowed' : 'pointer'}}
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ONBOARDING STEP 1: Profile Completion Modal */}
      {onboardingStep === 'profile' && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.preventDefault()}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth:600}}>
            <div className="modal-header">
              <strong>Complétez votre profil</strong>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:16,fontSize:14}}>Avant de continuer, veuillez renseigner vos informations personnelles.</p>
              <form onSubmit={(e) => { e.preventDefault(); save() }}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>PRÉNOM *</div>
                    <input value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} required />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>NOM *</div>
                    <input value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} required />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>TÉLÉPHONE *</div>
                    <input value={form.telephone} onChange={(e) => setForm({...form, telephone: e.target.value})} required />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>N'INAMI {isMed ? '*' : '(optionnel)'}</div>
                    <input value={form.ninami} onChange={(e) => setForm({...form, ninami: e.target.value})} required={isMed} />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>NISS *</div>
                    <input value={form.niss} onChange={(e) => setForm({...form, niss: fmtNiss(e.target.value)})} placeholder="94.05.06-421.50" required />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>BCE *</div>
                    <input value={form.bce} onChange={(e) => setForm({...form, bce: e.target.value})} placeholder="Numéro BCE" required />
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>SOCIÉTÉ (optionnel)</div>
                    <input value={form.societe} onChange={(e) => setForm({...form, societe: e.target.value})} placeholder="Optionnel" />
                    <div style={{fontSize:12,color:'#fff',fontWeight:600,marginTop:6,padding:8,background:'#f97316',borderRadius:4,lineHeight:1.4}}>⚠️ Ne remplir uniquement si vous êtes en société (personne morale)</div>
                  </label>
                  <label className="form-row">
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>COMPTE BANCAIRE *</div>
                    <input value={form.compte} onChange={(e) => setForm({...form, compte: fmtIban(e.target.value)})} placeholder="BE88 0000 0000 0000" required />
                  </label>
                  <label className="form-row" style={{gridColumn:'1 / -1'}}>
                    <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:6}}>ADRESSE *</div>
                    <div style={{display:'grid',gridTemplateColumns:'80px 1fr 100px 1fr',gap:8}}>
                      <input value={form.adresseNum} onChange={(e) => setForm({...form, adresseNum: e.target.value})} placeholder="N°" />
                      <input value={form.adresseRue} onChange={(e) => setForm({...form, adresseRue: e.target.value})} placeholder="Rue / Avenue..." required />
                      <input value={form.adresseCP} onChange={(e) => setForm({...form, adresseCP: e.target.value})} placeholder="Code postal" required />
                      <input value={form.adresseVille} onChange={(e) => setForm({...form, adresseVille: e.target.value})} placeholder="Localité" required />
                    </div>
                  </label>
                </div>
                {saveError && <div style={{color:'#d32f2f',fontSize:13,marginTop:12}}>{saveError}</div>}
                <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
                  <button 
                    type="submit" 
                    className="primary"
                    disabled={!isProfileFormValid(form, isMed)}
                    style={{opacity: !isProfileFormValid(form, isMed) ? 0.5 : 1, cursor: !isProfileFormValid(form, isMed) ? 'not-allowed' : 'pointer'}}
                  >
                    Continuer →
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING STEP 2: CGU & Privacy Acceptance Modal */}
      {onboardingStep === 'acceptance' && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.preventDefault()}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth:500}}>
            <div className="modal-header">
              <strong>Acceptez les conditions</strong>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:16,fontSize:14}}>Avant de continuer, vous devez accepter nos conditions d'utilisation et notre politique de confidentialité.</p>
              <form onSubmit={async (e) => { 
                e.preventDefault()
                setAcceptanceLoading(true)
                // Save acceptance flags to database before moving to password step
                try {
                  setSaveError(null)
                  const payload = {
                    email: user.email,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    telephone: form.telephone,
                    adresse: buildAdresse(form),
                    fonction: form.fonction,
                    ninami: form.ninami,
                    niss: form.niss,
                    bce: form.bce,
                    societe: form.societe,
                    compte: form.compte,
                    liaisonId: form.liaisonId,
                    acceptedCgu: !!form.acceptedCgu,
                    acceptedPrivacy: !!form.acceptedPrivacy,
                  }
                  const resp = await fetch(`/api/admin/users/${user.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  })
                  if (!resp.ok) {
                    const errorData = await resp.json()
                    throw new Error(errorData.detail || 'Erreur lors de la sauvegarde')
                  }
                  const body = await resp.json()
                  setUser(body.user)
                  // Now move to password step
                  setOnboardingStep('password')
                } catch (err) {
                  console.error('Save acceptance failed', err)
                  setAcceptanceError(err.message || 'Erreur lors de la sauvegarde')
                } finally {
                  setAcceptanceLoading(false)
                }
              }}>
                <div style={{padding:12, background:'#f3f4f6', borderRadius:6, marginBottom:16}}>
                  <label style={{display:'flex',alignItems:'flex-start',marginBottom:12,cursor:'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={!!form.acceptedCgu} 
                      onChange={(e) => setForm({...form, acceptedCgu: e.target.checked})}
                      style={{marginTop:2,marginRight:8,cursor:'pointer'}}
                      required
                    /> 
                    <span style={{fontSize:14}}>J'accepte les <a href="/cgu" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb',textDecoration:'underline'}}>Conditions Générales d'Utilisation (CGU)</a> *</span>
                  </label>
                  <label style={{display:'flex',alignItems:'flex-start',cursor:'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={!!form.acceptedPrivacy} 
                      onChange={(e) => setForm({...form, acceptedPrivacy: e.target.checked})}
                      style={{marginTop:2,marginRight:8,cursor:'pointer'}}
                      required
                    /> 
                    <span style={{fontSize:14}}>J'ai lu et j'accepte la <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb',textDecoration:'underline'}}>Politique de Confidentialité</a> *</span>
                  </label>
                </div>
                {acceptanceError && <div style={{color:'#d32f2f',fontSize:13,marginBottom:12}}>{acceptanceError}</div>}
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button type="button" className="secondary" onClick={() => setOnboardingStep('profile')} disabled={acceptanceLoading}>← Retour</button>
                  <button type="submit" className="primary" disabled={!form.acceptedCgu || !form.acceptedPrivacy || acceptanceLoading}>{acceptanceLoading ? 'Enregistrement…' : 'Continuer →'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING STEP 3: Password Change Modal */}
      {onboardingStep === 'password' && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.preventDefault()}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth:400}}>
            <div className="modal-header">
              <strong>Changez votre mot de passe</strong>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:16,fontSize:14}}>Pour finaliser votre inscription, veuillez changer votre mot de passe temporaire.</p>
              <form onSubmit={(e) => { e.preventDefault(); savePassword() }}>
                <label className="form-row full">
                  Mot de passe actuel
                  <input 
                    type="password" 
                    value={passwordForm.oldPassword} 
                    onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})} 
                  />
                </label>
                <label className="form-row full">
                  Nouveau mot de passe
                  <input 
                    type="password" 
                    value={passwordForm.newPassword} 
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} 
                  />
                </label>
                <label className="form-row full">
                  Confirmer le nouveau mot de passe
                  <input 
                    type="password" 
                    value={passwordForm.confirmPassword} 
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} 
                  />
                </label>
                {passwordError && <div className="form-error" style={{marginTop:12}}>{passwordError}</div>}
                {passwordSuccess && <div style={{color:'#10b981',fontSize:13,marginTop:12,fontWeight:600}}>Mot de passe modifié avec succès!</div>}
                <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
                  {!['moderator','comptabilite','admin'].some(r => user?.role?.includes(r)) && (
                    <button type="button" className="secondary" onClick={() => setOnboardingStep('acceptance')} disabled={passwordLoading}>← Retour</button>
                  )}
                  <button type="submit" className="primary" disabled={passwordLoading}>{passwordLoading ? 'Enregistrement…' : 'Valider'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
