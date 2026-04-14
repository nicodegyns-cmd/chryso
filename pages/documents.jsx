import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'

const STATUS = {
  approved: { label: 'Validé',      bg: '#dcfce7', color: '#166534', border: '#86efac', icon: '✅' },
  rejected: { label: 'Rejeté',      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: '❌' },
  pending:  { label: 'En attente',  bg: '#fef9c3', color: '#854d0e', border: '#fde047', icon: '⏳' },
}

function docIcon(type) {
  const t = (type || '').toUpperCase()
  if (t === 'PDF') return '📄'
  if (['JPG','JPEG','PNG','WEBP','GIF'].includes(t)) return '🖼️'
  if (['DOC','DOCX'].includes(t)) return '📝'
  return '📎'
}

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function DocumentsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('tous')

  useEffect(() => {
    const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
    if (!email) return
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const me = (data.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase())
        if (!me) return
        const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
        if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) router.push('/profile')
        else if (!me.is_active) router.push('/account-pending')
      } catch {}
    }
    checkStatus()
  }, [router])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null
        if (!email) { setDocuments([]); return }
        const r = await fetch(`/api/documents?email=${encodeURIComponent(email)}`)
        const data = r.ok ? await r.json() : {}
        setDocuments(data.documents || [])
      } catch { setDocuments([]) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const counts = {
    tous: documents.length,
    approved: documents.filter(d => d.validation_status === 'approved').length,
    pending:  documents.filter(d => d.validation_status === 'pending' || !d.validation_status).length,
    rejected: documents.filter(d => d.validation_status === 'rejected').length,
  }

  const filtered = statusFilter === 'tous'
    ? documents
    : statusFilter === 'pending'
      ? documents.filter(d => d.validation_status === 'pending' || !d.validation_status)
      : documents.filter(d => d.validation_status === statusFilter)

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>

        <div className="admin-header">
          <h1>📄 Mes documents</h1>
          <div className="small-muted">Tous vos documents uploadés et leurs statuts de validation</div>
        </div>

        {loading ? (
          <div className="admin-card card" style={{padding:'48px 24px',textAlign:'center',color:'#6b7280'}}>
            <div style={{fontSize:36,marginBottom:12}}>⏳</div>
            <div>Chargement des documents...</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="admin-card card" style={{padding:'64px 24px',textAlign:'center'}}>
            <div style={{fontSize:52,marginBottom:16}}>📋</div>
            <div style={{fontSize:18,fontWeight:700,color:'#1f2937',marginBottom:8}}>Aucun document</div>
            <div style={{fontSize:14,color:'#9ca3af'}}>Les documents que vous envoyez apparaîtront ici avec leur statut de validation.</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
              {[
                { key:'tous',     label:'Total',      bg:'#f3f4f6', color:'#374151', border:'#e5e7eb', icon:'📁' },
                { key:'approved', label:'Validés',    ...STATUS.approved },
                { key:'pending',  label:'En attente', ...STATUS.pending  },
                { key:'rejected', label:'Rejetés',    ...STATUS.rejected  },
              ].map(s => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  style={{border:`2px solid ${statusFilter === s.key ? s.color : s.border}`,borderRadius:10,
                    background: statusFilter === s.key ? s.bg : '#fff',
                    padding:'14px 16px',textAlign:'left',cursor:'pointer',transition:'all 0.15s'}}>
                  <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:22,fontWeight:800,color:s.color}}>{counts[s.key]}</div>
                  <div style={{fontSize:12,color:s.color,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
                </button>
              ))}
            </div>

            {/* Rejected banner */}
            {counts.rejected > 0 && (
              <div style={{display:'flex',gap:12,alignItems:'flex-start',padding:'14px 16px',background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:10,marginBottom:20}}>
                <div style={{fontSize:22}}>⚠️</div>
                <div>
                  <div style={{fontWeight:700,color:'#991b1b',marginBottom:2}}>
                    {counts.rejected} document{counts.rejected > 1 ? 's' : ''} rejeté{counts.rejected > 1 ? 's' : ''}
                  </div>
                  <div style={{fontSize:13,color:'#b91c1c'}}>Consultez la raison du rejet et soumettez une nouvelle version si nécessaire.</div>
                </div>
              </div>
            )}

            {/* Document grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
              {filtered.map(doc => {
                const st = STATUS[doc.validation_status] || STATUS.pending
                const ext = (doc.type || doc.name?.split('.').pop() || '').toUpperCase()
                return (
                  <div key={doc.id} style={{background:'#fff',border:`1px solid #e5e7eb`,borderRadius:12,
                    overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',flexDirection:'column',
                    transition:'box-shadow 0.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'}>

                    {/* Header */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                      padding:'12px 16px',background:'#f9fafb',borderBottom:'1px solid #f0f0f0'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:20}}>{docIcon(ext)}</span>
                        <span style={{fontSize:12,fontWeight:700,color:'#1d4ed8',background:'#dbeafe',
                          padding:'2px 8px',borderRadius:20}}>{ext || 'FICHIER'}</span>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:st.color,background:st.bg,
                        border:`1px solid ${st.border}`,padding:'3px 10px',borderRadius:20,display:'flex',gap:5,alignItems:'center'}}>
                        {st.icon} {st.label}
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{padding:'16px',flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:'#111827',marginBottom:10,
                        wordBreak:'break-word',lineHeight:'1.4'}}>{doc.name || 'Document'}</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div>
                          <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Date</div>
                          <div style={{fontSize:13,color:'#374151'}}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '—'}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Taille</div>
                          <div style={{fontSize:13,color:'#374151'}}>{formatSize(doc.file_size)}</div>
                        </div>
                      </div>
                      {doc.validation_status === 'rejected' && doc.rejection_reason && (
                        <div style={{marginTop:12,padding:'10px 12px',background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#991b1b',textTransform:'uppercase',marginBottom:4}}>Raison du rejet</div>
                          <div style={{fontSize:13,color:'#b91c1c',lineHeight:'1.5'}}>{doc.rejection_reason}</div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{padding:'12px 16px',borderTop:'1px solid #f0f0f0',background:'#fafafa'}}>
                      <a href={doc.url || `/api/documents/serve?id=${doc.id}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',
                          background:'#2563eb',color:'#fff',padding:'9px 0',borderRadius:8,
                          textDecoration:'none',fontWeight:600,fontSize:14,boxSizing:'border-box'}}>
                        👁️ Voir le document
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
