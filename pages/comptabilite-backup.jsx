import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminHeader from '../components/AdminHeader'
import UserSidebar from '../components/UserSidebar'
import adminStyles from './admin/rib-validation.module.css'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function ComptabilitePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [prestations, setPrestations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('sent_to_billing') // Default filter
  const [searchQuery, setSearchQuery] = useState('')
  const [ribPendingCount, setRibPendingCount] = useState(0)
  const [fichePendingCount, setFichePendingCount] = useState(0)
  const [ribModalOpen, setRibModalOpen] = useState(false)
  const [ribDocuments, setRibDocuments] = useState([])
  const [ficheModalOpen, setFicheModalOpen] = useState(false)
  const [ficheUsers, setFicheUsers] = useState([])
  const [ficheViewerOpen, setFicheViewerOpen] = useState(false)
  const [selectedFiche, setSelectedFiche] = useState(null)
  const [confirmEncodeOpen, setConfirmEncodeOpen] = useState(false)
  const [confirmDoc, setConfirmDoc] = useState(null)
  const [selectedPrestation, setSelectedPrestation] = useState(null)
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false)
  const [confirmPaymentItem, setConfirmPaymentItem] = useState(null)
  const [correctionWizardOpen, setCorrectionWizardOpen] = useState(false)
  const [correctionStep, setCorrectionStep] = useState(1)
  const [correctionAllPrestations, setCorrectionAllPrestations] = useState([])
  const [correctionLoadingData, setCorrectionLoadingData] = useState(false)
  const [correctionSelectedUserId, setCorrectionSelectedUserId] = useState('')
  const [correctionSelectedInvoice, setCorrectionSelectedInvoice] = useState('')
  const [correctionSelectedPrestation, setCorrectionSelectedPrestation] = useState(null)
  const [correctionAmount, setCorrectionAmount] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false)
  const [avoirsModalOpen, setAvoirsModalOpen] = useState(false)
  const [avoirs, setAvoirs] = useState([])
  const [avoirsLoading, setAvoirsLoading] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingIds, setExportingIds] = useState({})
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterAnalytic, setFilterAnalytic] = useState('')
  const [filterInvoiceNumbers, setFilterInvoiceNumbers] = useState([])
  const [invoiceFilterOpen, setInvoiceFilterOpen] = useState(false)

  // pharmacien forfaits
  const [pharmacienGroups, setPharmacienGroups] = useState([])
  const [pharmacienLoading, setPharmacienLoading] = useState(false)
  const [generatingForfait, setGeneratingForfait] = useState({})

  const userRole = useLocalStorage('role', null)
  const userEmail = useLocalStorage('email', '')

  // Check user status: onboarding > pending validation > full access
  useEffect(() => {
    if (!userEmail) return
    
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        const list = data.users || []
        const me = list.find((u) => (u.email || '').toLowerCase() === userEmail.toLowerCase())
        
        if (!me) return
        
        // Priority 1: If onboarding not complete, go to profile (only for INFI/MED roles)
        const mustCompleteRoles = ['INFI', 'MED', 'infirmier', 'medecin']
        if (me.must_complete_profile && mustCompleteRoles.some(r => me.role?.includes(r))) {
          router.push('/profile')
        }
        // Priority 2: If onboarding complete but not active, show pending validation
        else if (!me.is_active) {
          router.push('/account-pending')
        }
      } catch (err) {
        console.error('Failed to check user status', err)
      }
    }
    
    checkStatus()
  }, [userEmail, router])

  // Redirect non-comptabilité users
  useEffect(() => {
    // Only check if userRole has been initialized (not null)
    if (userRole === null) {
      console.log('[comptabilite.jsx] waiting for role to initialize')
      return
    }
    console.log('[comptabilite.jsx] guard check - role is:', userRole)
    if (userRole !== 'comptabilite') {
      console.log('[comptabilite.jsx] redirecting to /dashboard - user is not comptabilite')
      router.push('/dashboard')
    } else {
      console.log('[comptabilite.jsx] role is comptabilite, allowing access')
    }
  }, [userRole, router])

  // Fetch prestations sent to billing
  useEffect(() => {
    fetchPrestations()
  }, [filterStatus, filterDateFrom, filterDateTo])

  // Fetch pharmacien forfaits
  useEffect(() => {
    fetchPharmacienForfaits()
  }, [filterStatus])

  // Fetch approved RIB documents count (for badge)
  useEffect(() => {
    let mounted = true
    async function fetchApprovedDocs() {
      try {
        const res = await fetch('/api/admin/documents/approved')
        if (!res.ok) throw new Error('Erreur récupération documents')
        const data = await res.json()
        const docs = data.documents || []
        const ribDocs = docs.filter(d => {
          const t = (d.type || '').toString().toLowerCase()
          const n = (d.name || '').toString().toLowerCase()
          return t.includes('rib') || n.includes('rib')
        })
        if (mounted) setRibPendingCount(ribDocs.length)
      } catch (err) {
        console.warn('Failed loading approved docs', err.message)
      }
    }
    fetchApprovedDocs()
    return () => { mounted = false }
  }, [])

  async function openRibModal() {
    setRibModalOpen(true)
    try {
      const res = await fetch('/api/admin/documents/approved')
      if (!res.ok) throw new Error('Erreur récupération documents')
      const data = await res.json()
      const docs = data.documents || []
      const ribDocs = docs.filter(d => {
        const t = (d.type || '').toString().toLowerCase()
        const n = (d.name || '').toString().toLowerCase()
        return t.includes('rib') || n.includes('rib')
      })
      setRibDocuments(ribDocs)
    } catch (e) {
      console.error('Failed loading RIB docs', e.message)
      setRibDocuments([])
    }
  }

  async function markAsEncoded(documentId) {
    try {
      const res = await fetch('/api/admin/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, status: 'encoded' })
      })
      if (!res.ok) throw new Error('Failed to mark encoded')
      // remove from list
      setRibDocuments(prev => prev.filter(d => d.id !== documentId))
      setRibPendingCount(c => Math.max(0, c - 1))
    } catch (e) {
      console.error('Encode failed', e.message)
      alert('Erreur lors de l\'encodage')
    }
  }

  async function openFicheModal() {
    setFicheModalOpen(true)
    try {
      const res = await fetch('/api/admin/users/active')
      if (!res.ok) throw new Error('Erreur récupération fiches')
      const data = await res.json()
      const items = data.items || []
      setFicheUsers(items)
      setFichePendingCount(items.length)
    } catch (e) {
      console.error('Failed loading fiches', e.message)
      setFicheUsers([])
    }
  }

  // Fetch active validated users count (INFI/MED) for fiche counter
  useEffect(() => {
    let mounted = true
    async function fetchActiveCount() {
      try {
        const res = await fetch('/api/admin/users/active')
        if (!res.ok) return
        const data = await res.json()
        if (mounted) setFichePendingCount((data.items || []).length)
      } catch (err) {
        console.warn('Failed loading active users count', err.message)
      }
    }
    fetchActiveCount()
    return () => { mounted = false }
  }, [])

  async function fetchPrestations() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStatus === 'sent_to_billing') {
        params.append('status', 'sent_to_billing')
      } else if (filterStatus === 'invoiced') {
        params.append('status', 'invoiced')
      } else if (filterStatus === 'paid') {
        params.append('status', 'paid')
      } else if (filterStatus === 'all') {
        params.append('status', 'all')
      }
      if (filterDateFrom) params.append('date_from', filterDateFrom)
      if (filterDateTo) params.append('date_to', filterDateTo)

      const res = await fetch(`/api/comptabilite/prestations?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors de la récupération')

      const data = await res.json()
      setPrestations(Array.isArray(data) ? data : data.prestations || [])
    } catch (err) {
      setError(err.message)
      setPrestations([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchPharmacienForfaits() {
    setPharmacienLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus === 'sent_to_billing') params.append('status', 'sent_to_billing')
      else if (filterStatus === 'invoiced') params.append('status', 'invoiced')
      else if (filterStatus === 'all') params.append('status', 'all')
      else params.append('status', 'sent_to_billing')

      const res = await fetch(`/api/comptabilite/pharmacien-forfaits?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur récupération forfaits pharmacien')
      const data = await res.json()
      setPharmacienGroups(data.groups || [])
    } catch (err) {
      console.warn('[comptabilite] pharmacien forfaits error:', err.message)
      setPharmacienGroups([])
    } finally {
      setPharmacienLoading(false)
    }
  }

  async function generateForfaitInvoice(group) {
    const ok = confirm(`💊 Générer la facture forfait 400€ pour ${group.user_name} — période ${group.period_label} ?\n\nCela va créer une facture de 400€ et marquer les ${group.prestations.length} session(s) comme « Facturé ».`)
    if (!ok) return
    setGeneratingForfait(prev => ({ ...prev, [group.group_key]: true }))
    try {
      const prestationIds = group.prestations.map(p => p.id)
      // Generate the forfait PDF invoice (1h fictive × 400€ = forfait 400€)
      const invoiceRes = await fetch('/api/admin/manual-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: group.user_id,
          garde_hours: 1,
          sortie_hours: 0,
          overtime_hours: 0,
          unit_price: 400,
          comments: `Forfait pharmacien demi-mois ${group.period_label} — ${group.prestations.length} session(s), ${(group.total_hours || 0).toFixed(2)}h au total`,
          analytic_id: group.analytic_id || null,
        })
      })
      if (!invoiceRes.ok) {
        const errData = await invoiceRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur génération facture')
      }
      const invoiceData = await invoiceRes.json()
      // Mark all prestations in this period as "Facturé"
      for (const id of prestationIds) {
        await fetch(`/api/admin/prestations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Facturé' })
        })
      }
      if (invoiceData.pdf_url) {
        window.open(invoiceData.pdf_url, '_blank')
      }
      alert(`✅ Facture forfait 400€ générée pour ${group.user_name} — ${group.period_label}`)
      fetchPharmacienForfaits()
    } catch (err) {
      alert('❌ Erreur: ' + err.message)
    } finally {
      setGeneratingForfait(prev => { const n = { ...prev }; delete n[group.group_key]; return n })
    }
  }

  async function exportForAnalytic(analyticId, analyticName) {
    const analyticPrestations = filteredPrestations.filter(p => {
      const pId = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
      return pId === (analyticId === 'unassigned' ? 'unassigned' : String(analyticId))
    })
    if (analyticPrestations.length === 0) {
      alert('❌ Aucune prestation à exporter pour cette analytique')
      return
    }
    const userCount = new Set(analyticPrestations.map(p => p.user_id)).size
    const ok = confirm(`📤 Exporter ${analyticPrestations.length} prestation(s) pour ${userCount} collaborateur(s) — ${analyticName} ?\n\nCela va générer une facture par collaborateur et les compiler en un seul PDF.\nToutes ces prestations seront marquées comme « Facturé ».`)
    if (!ok) return

    setExportingIds(prev => ({ ...prev, [analyticId]: true }))
    try {
      const res = await fetch('/api/comptabilite/export-all-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestation_ids: analyticPrestations.map(p => p.id),
          analyticName
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur lors de l\'export')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Factures_${analyticName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      await new Promise(resolve => setTimeout(resolve, 500))
      setFilterStatus('invoiced')
      fetchPrestations()
    } catch (err) {
      console.error('Export analytic failed:', err)
      alert('❌ Erreur lors de l\'export: ' + err.message)
    } finally {
      setExportingIds(prev => { const n = { ...prev }; delete n[analyticId]; return n })
    }
  }

  async function cancelPrestation(prestationId) {
    if (!confirm('Annuler cette prestation ? Elle repassera au statut "À saisir" pour l\'utilisateur.')) return
    try {
      const r = await fetch(`/api/admin/prestations/${prestationId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Erreur')
      fetchPrestations()
    } catch (err) {
      alert('❌ Erreur lors de l\'annulation: ' + err.message)
    }
  }

  const [recompiling, setRecompiling] = useState(false)
  const [recompilingByAnalytic, setRecompilingByAnalytic] = useState(false)

  function resetCorrectionWizard() {
    setCorrectionWizardOpen(false)
    setCorrectionStep(1)
    setCorrectionAllPrestations([])
    setCorrectionSelectedUserId('')
    setCorrectionSelectedInvoice('')
    setCorrectionSelectedPrestation(null)
    setCorrectionAmount('')
    setCorrectionReason('')
  }

  async function openAvoirsModal() {
    setAvoirsModalOpen(true)
    setAvoirsLoading(true)
    try {
      const res = await fetch('/api/comptabilite/avoirs')
      const data = await res.json()
      setAvoirs(data.avoirs || [])
    } catch (e) {
      console.error('Erreur chargement avoirs:', e.message)
      setAvoirs([])
    } finally {
      setAvoirsLoading(false)
    }
  }

  async function openCorrectionWizard() {
    setCorrectionWizardOpen(true)
    setCorrectionStep(1)
    setCorrectionSelectedUserId('')
    setCorrectionSelectedInvoice('')
    setCorrectionSelectedPrestation(null)
    setCorrectionAmount('')
    setCorrectionReason('')
    setCorrectionLoadingData(true)
    try {
      const res = await fetch('/api/comptabilite/prestations?status=all')
      const data = await res.json()
      const all = (Array.isArray(data) ? data : data.prestations || []).filter(p =>
        p && (p.status === 'Facturé' || p.status === 'Payé')
      )
      setCorrectionAllPrestations(all)
    } catch (e) {
      console.error('Erreur chargement prestations correction:', e.message)
      setCorrectionAllPrestations([])
    } finally {
      setCorrectionLoadingData(false)
    }
  }

  async function submitCorrectionAvoir() {
    if (!correctionSelectedPrestation) return
    if (!correctionAmount || Number(correctionAmount) <= 0) { alert('Montant invalide'); return }
    if (!correctionReason.trim()) { alert('La raison est obligatoire'); return }
    setCorrectionSubmitting(true)
    try {
      const res = await fetch('/api/comptabilite/create-avoir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_id: correctionSelectedPrestation.id, amount: Number(correctionAmount), reason: correctionReason })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      alert(`✅ ${data.message}`)
      resetCorrectionWizard()
    } catch (e) {
      alert('❌ Erreur : ' + e.message)
    } finally {
      setCorrectionSubmitting(false)
    }
  }

  async function recompileByAnalytic() {
    const invoiced = filteredPrestations.filter(p => p && p.status === 'Facturé')
    if (invoiced.length === 0) {
      alert('Aucune prestation facturée dans la sélection actuelle')
      return
    }
    // Grouper par analytique
    const analyticMap = new Map()
    for (const p of invoiced) {
      const key = p.analytic_id != null ? String(p.analytic_id) : 'null'
      if (!analyticMap.has(key)) {
        analyticMap.set(key, { analytic_id: p.analytic_id ?? null, name: p.analytic_name || 'Non assigné', ids: [] })
      }
      analyticMap.get(key).ids.push(p.id)
    }
    const analytics = Array.from(analyticMap.values())
    const ok = confirm(`📂 Décompiler en ${analytics.length} PDF(s) — un par analytique ?\n\nAucun statut ne sera modifié.`)
    if (!ok) return
    setRecompilingByAnalytic(true)
    try {
      for (const analytic of analytics) {
        const res = await fetch('/api/comptabilite/recompile-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prestation_ids: analytic.ids, regenerate: true }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Erreur pour ${analytic.name}`)
        }
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const safeName = analytic.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        link.download = `Recompilation_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    } catch (err) {
      alert('❌ Erreur : ' + err.message)
    } finally {
      setRecompilingByAnalytic(false)
    }
  }

  async function recompilePdf() {
    const invoiced = filteredPrestations.filter(p => p && p.status === 'Facturé')
    if (invoiced.length === 0) {
      alert('Aucune prestation facturée dans la sélection actuelle')
      return
    }
    const ok = confirm(`📄 Recompiler un PDF avec les ${invoiced.length} facture(s) déjà générées ?\n\nCela ne change aucun statut, ne renvoie pas d'emails.`)
    if (!ok) return
    setRecompiling(true)
    try {
      const body = {
        prestation_ids: invoiced.map(p => p.id),
        ...(filterAnalytic && filterAnalytic !== 'unassigned' ? { analytic_id: Number(filterAnalytic) } : {})
      }
      const res = await fetch('/api/comptabilite/recompile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur lors de la recompilation')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Recompilation_Factures_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('❌ Erreur : ' + err.message)
    } finally {
      setRecompiling(false)
    }
  }

  async function exportAll() {
    const pending = safePrestations.filter(p => p && (p.status === 'sent_to_billing' || p.status === 'Envoyé à la facturation'))
    if (pending.length === 0) {
      alert('❌ Aucune prestation à facturer (statut "À facturer")')
      return
    }

    // Construire la liste des analytiques distinctes
    const analyticMap = new Map()
    for (const p of pending) {
      const key = p.analytic_id != null ? String(p.analytic_id) : 'null'
      if (!analyticMap.has(key)) {
        analyticMap.set(key, {
          analytic_id: p.analytic_id != null ? p.analytic_id : null,
          name: p.analytic_name || 'Non assigné',
        })
      }
    }
    const analytics = Array.from(analyticMap.values())

    const nbAnalytics = analytics.length
    const nbUsers = new Set(pending.map(p => p.user_id)).size
    const ok = confirm(`📤 Exporter TOUTES les ${pending.length} prestation(s) pour ${nbUsers} collaborateur(s) ?\n\nCela va générer ${nbAnalytics} compilation(s) PDF — une par analytique.\nToutes les prestations seront marquées comme « Facturé ».`)
    if (!ok) return

    setExportingAll(true)
    const dateStr = new Date().toISOString().split('T')[0]
    const errors = []

    try {
      for (const analytic of analytics) {
        try {
          const res = await fetch('/api/comptabilite/export-all-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              analytic_id: analytic.analytic_id,
              analyticName: analytic.name,
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            errors.push(`${analytic.name} : ${errData.error || 'Erreur inconnue'}`)
            continue
          }
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const safeName = analytic.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
          link.download = `Compilation_Factures_${safeName}_${dateStr}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          // Délai entre chaque téléchargement pour ne pas bloquer le navigateur
          await new Promise(resolve => setTimeout(resolve, 800))
        } catch (err) {
          errors.push(`${analytic.name} : ${err.message}`)
        }
      }

      if (errors.length > 0) {
        alert(`⚠️ ${errors.length} analytique(s) en erreur :\n${errors.join('\n')}`)
      }

      setFilterStatus('invoiced')
      fetchPrestations()
    } catch (err) {
      console.error('Export failed:', err)
      alert('❌ Erreur lors de l\'export: ' + err.message)
    } finally {
      setExportingAll(false)
    }
  }

  // Guard against null entries returned by APIs
  const safePrestations = (prestations || []).filter(Boolean)

  // Build unique invoice number list from loaded prestations (sorted)
  const invoiceNumberOptions = [...new Set(
    safePrestations.map(p => p.invoice_number).filter(Boolean)
  )].sort((a, b) => {
    // Sort by year then sequence: "2026-001" → compare numerically
    const [ay = 0, an = 0] = (a || '').split('-').map(Number)
    const [by = 0, bn = 0] = (b || '').split('-').map(Number)
    return ay !== by ? ay - by : an - bn
  })

  // Build unique analytic list from loaded prestations
  const analyticOptions = Array.from(
    safePrestations.reduce((map, p) => {
      const id = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
      const name = p.analytic_name || 'Non assigné'
      if (!map.has(id)) map.set(id, name)
      return map
    }, new Map())
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredPrestations = safePrestations.filter(p => {
    const query = (searchQuery || '').toLowerCase()
    const matchSearch = (
      (p.user_name || '').toString().toLowerCase().includes(query) ||
      (p.first_name || '').toString().toLowerCase().includes(query) ||
      (p.last_name || '').toString().toLowerCase().includes(query) ||
      (p.email || '').toString().toLowerCase().includes(query) ||
      (p.activity_type || '').toString().toLowerCase().includes(query)
    )
    const dateVal = (p.date || p.created_at || '').slice(0, 10)
    const matchFrom = !filterDateFrom || dateVal >= filterDateFrom
    const matchTo = !filterDateTo || dateVal <= filterDateTo
    const matchAnalytic = !filterAnalytic || (
      filterAnalytic === 'unassigned'
        ? (p.analytic_id == null)
        : String(p.analytic_id) === filterAnalytic
    )
    const matchInvoice = filterInvoiceNumbers.length === 0 || filterInvoiceNumbers.includes(p.invoice_number || '')
    return matchSearch && matchFrom && matchTo && matchAnalytic && matchInvoice
  })

  // Basic stats for cards
  const pendingPrestations = safePrestations.filter(p => (p && p.status) === 'sent_to_billing')
  const pendingCount = pendingPrestations.length
  const pendingAmount = pendingPrestations.reduce((sum, p) => sum + (parseFloat(p && p.remuneration) || 0), 0)
  if (userRole && userRole !== 'comptabilite') {
    return null
  }

  return (
    <div className="admin-page-root">
      <AdminHeader onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="admin-content" onClick={() => { if (sidebarOpen) setSidebarOpen(false) }}>
        {/* Header */}
        <div style={{marginBottom: 32}}>
          <h1 style={{fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8}}>
            💰 Gestion des Prestations à Facturer
          </h1>
          <p style={{color: '#6b7280', fontSize: 14}}>
            Tableau de bord comptabilité - Prestations en attente de facturation
          </p>
        </div>

        {/* Stat cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24}}>
          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>📤 En attente de facturation</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827'}}>{pendingCount}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Montant estimé: {pendingAmount.toFixed(2)} €</div>
          </div>

          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>🧾 Total Prestations</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827'}}>{safePrestations.length}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Montant total: {safePrestations.reduce((s,p)=> s + (parseFloat(p && p.remuneration || 0)||0),0).toFixed(2)} €</div>
          </div>

          <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>🏦 RIB en attente d'encodage</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer'}} onClick={openRibModal}>{ribPendingCount}</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Documents RIB soumis par les utilisateurs</div>
          </div>
            <div style={{background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
              <div style={{fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 700}}>📋 Fiches renseignement</div>
                <div style={{fontSize: 22, fontWeight: 800, color: '#111827', cursor: 'pointer'}} onClick={openFicheModal}>{fichePendingCount}</div>
              <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Prestataires validés (INFI / MED)</div>
            </div>
        </div>

        {/* Filters */}
        <div style={{
          background: 'white',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16}}>
            {/* Search */}
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                🔍 Rechercher
              </label>
              <input 
                type="text"
                placeholder="Nom, email, activité..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                📋 Statut
              </label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: 'white'
                }}
              >
                <option value="sent_to_billing">À facturer</option>
                <option value="invoiced">Facturées</option>
                <option value="paid">Payées</option>
                <option value="all">Toutes</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>📅 Du</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                style={{width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14}} />
            </div>

            {/* Date To */}
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>Au</label>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                  style={{flex:1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14}} />
                {(filterDateFrom || filterDateTo) && (
                  <button onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                    title="Effacer les dates"
                    style={{padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, background:'#f3f4f6', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151'}}>
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Analytic Filter */}
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>📊 Analytique</label>
              <select
                value={filterAnalytic}
                onChange={e => setFilterAnalytic(e.target.value)}
                style={{width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: 'white'}}
              >
                <option value="">Toutes les analytiques</option>
                {analyticOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            {/* Invoice Number Multi-Select Filter */}
            <div style={{position: 'relative'}}>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151'}}>
                📄 N° Facture
                {filterInvoiceNumbers.length > 0 && (
                  <span style={{marginLeft: 6, background: '#4f46e5', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11}}>
                    {filterInvoiceNumbers.length}
                  </span>
                )}
              </label>
              <button
                onClick={() => setInvoiceFilterOpen(o => !o)}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6,
                  fontSize: 14, background: 'white', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: filterInvoiceNumbers.length > 0 ? '#4f46e5' : '#6b7280'
                }}
              >
                <span>
                  {filterInvoiceNumbers.length === 0
                    ? 'Toutes les factures'
                    : filterInvoiceNumbers.length === 1
                      ? filterInvoiceNumbers[0]
                      : `${filterInvoiceNumbers[0]} + ${filterInvoiceNumbers.length - 1} autre(s)`
                  }
                </span>
                <span style={{fontSize: 10}}>{invoiceFilterOpen ? '▲' : '▼'}</span>
              </button>
              {invoiceFilterOpen && (
                <div style={{
                  position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0,
                  background: 'white', border: '1px solid #d1d5db', borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
                }}>
                  {filterInvoiceNumbers.length > 0 && (
                    <div
                      onClick={() => setFilterInvoiceNumbers([])}
                      style={{padding: '8px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontWeight: 600}}
                    >
                      ✕ Tout effacer
                    </div>
                  )}
                  {invoiceNumberOptions.length === 0 && (
                    <div style={{padding: '8px 12px', fontSize: 13, color: '#9ca3af'}}>Aucun n° de facture disponible</div>
                  )}
                  {invoiceNumberOptions.map(num => (
                    <label key={num} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                      background: filterInvoiceNumbers.includes(num) ? '#eef2ff' : 'transparent'
                    }}>
                      <input
                        type="checkbox"
                        checked={filterInvoiceNumbers.includes(num)}
                        onChange={() => setFilterInvoiceNumbers(prev =>
                          prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                        )}
                        style={{accentColor: '#4f46e5'}}
                      />
                      {num}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export Button — Global */}
        {filterStatus === 'sent_to_billing' && pendingCount > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16
          }}>
            <button
              onClick={exportAll}
              disabled={exportingAll}
              style={{
                padding: '12px 24px',
                background: exportingAll ? '#9ca3af' : '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: exportingAll ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(79,70,229,0.3)',
                transition: 'all 0.2s'
              }}
            >
              {exportingAll
                ? '⏳ Génération en cours... (1 PDF par analytique)'
                : `📤 Exporter toutes les factures (${pendingCount} prestations)`}
            </button>
          </div>
        )}

        {/* Recompile Button — for already invoiced */}
        {filterStatus === 'invoiced' && filteredPrestations.filter(p => p.status === 'Facturé').length > 0 && (
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16}}>
            <button
              onClick={recompileByAnalytic}
              disabled={recompilingByAnalytic || recompiling}
              style={{
                padding: '12px 24px',
                background: recompilingByAnalytic ? '#9ca3af' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: (recompilingByAnalytic || recompiling) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(124,58,237,0.3)',
              }}
            >
              {recompilingByAnalytic
                ? '⏳ Décompilation en cours...'
                : `📂 Décompiler par analytique`}
            </button>
            <button
              onClick={recompilePdf}
              disabled={recompiling || recompilingByAnalytic}
              style={{
                padding: '12px 24px',
                background: recompiling ? '#9ca3af' : '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: (recompiling || recompilingByAnalytic) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(8,145,178,0.3)',
              }}
            >
              {recompiling
                ? '⏳ Compilation en cours...'
                : `📄 Retelecharger la compilation PDF (${filteredPrestations.filter(p => p.status === 'Facturé').length} factures)`}
            </button>
          </div>
        )}

        {/* Correction Facture + Historique Avoirs Buttons */}
        <div style={{display:'flex', justifyContent:'flex-end', gap:10, marginBottom:16}}>
          <button
            onClick={openAvoirsModal}
            style={{
              padding:'11px 20px',
              background:'#6b7280',
              color:'white',
              border:'none',
              borderRadius:8,
              cursor:'pointer',
              fontSize:14,
              fontWeight:700,
              boxShadow:'0 2px 6px rgba(107,114,128,0.3)',
              display:'flex',
              alignItems:'center',
              gap:8
            }}
          >
            📋 Historique avoirs
          </button>
          <button
            onClick={openCorrectionWizard}
            style={{
              padding:'11px 20px',
              background:'#f59e0b',
              color:'white',
              border:'none',
              borderRadius:8,
              cursor:'pointer',
              fontSize:14,
              fontWeight:700,
              boxShadow:'0 2px 6px rgba(245,158,11,0.3)',
              display:'flex',
              alignItems:'center',
              gap:8
            }}
          >
            ⚠️ Correction facture
          </button>
        </div>

        {/* Prestations by Analytic - Grouped View */}
        {loading ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8}}>
            <div style={{fontSize: 14}}>⏳ Chargement des prestations...</div>
          </div>
        ) : error ? (
          <div style={{padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 6}}>
            <strong>❌ Erreur :</strong> {error}
          </div>
        ) : filteredPrestations.length === 0 ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: 8}}>
            <div style={{fontSize: 32, marginBottom: 8}}>📭</div>
            <div style={{fontSize: 14}}>Aucune prestation trouvée</div>
          </div>
        ) : (
          <>
            {Object.entries(
              filteredPrestations.reduce((groups, p) => {
                // Create unique key from analytic_id or name
                const analyticId = p.analytic_id || 'unassigned'
                const analyticName = p.analytic_name || 'Non assigné'
                const groupKey = `${analyticId}|${analyticName}`
                
                if (!groups[groupKey]) {
                  groups[groupKey] = {
                    items: [],
                    analyticId,
                    analyticName
                  }
                }
                groups[groupKey].items.push(p)
                return groups
              }, {})
            ).map(([groupKey, analyticGroup]) => {
              const { items: analyticsItems, analyticId, analyticName } = analyticGroup
              const analyticTotal = analyticsItems.reduce((sum, p) => sum + parseFloat(p.remuneration || 0), 0)
              
              return (
                <div key={groupKey} style={{marginBottom: 32}}>
                  {/* Analytic Header with Export Button */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <div>
                      <h2 style={{fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4}}>
                        📊 {analyticName}
                      </h2>
                      <p style={{fontSize: 12, color: '#6b7280'}}>
                        {analyticsItems.length} prestation{analyticsItems.length > 1 ? 's' : ''} • Montant total: {analyticTotal.toFixed(2)} €
                      </p>
                    </div>
                    <button
                      onClick={() => exportForAnalytic(analyticId, analyticName)}
                      disabled={exportingIds[analyticId] || analyticsItems.length === 0}
                      style={{
                        padding: '10px 16px',
                        background: analyticsItems.length === 0 ? '#d1d5db' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: analyticsItems.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        opacity: exportingIds[analyticId] ? 0.7 : 1,
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => { if (analyticsItems.length > 0) e.currentTarget.style.background = '#059669' }}
                      onMouseLeave={(e) => { if (analyticsItems.length > 0) e.currentTarget.style.background = '#10b981' }}
                    >
                      {exportingIds[analyticId] ? '⏳ Export en cours...' : '📄 Exporter'}
                    </button>
                  </div>

                  {/* Analytic Table */}
                  <div style={{
                    background: 'white',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                  }}>
                    <div style={{overflowX: 'auto'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr style={{background: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Collaborateur</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Activité</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Montant</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Date</th>
                            <th style={{padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151'}}>Statut</th>
                            <th style={{padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151'}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsItems.map((prestation, idx) => (
                            <tr key={prestation.id || idx} style={{borderBottom: '1px solid #e5e7eb'}}>
                              <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                                {prestation.user_name || `${prestation.first_name} ${prestation.last_name}`.trim()}
                              </td>
                              <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                                {prestation.activity_type || '-'}
                              </td>
                              <td style={{padding: 12, fontSize: 13, fontWeight: 600, color: '#1f2937'}}>
                                {parseFloat(prestation.remuneration || 0).toFixed(2)} €
                              </td>
                              <td style={{padding: 12, fontSize: 13, color: '#374151'}}>
                                {new Date(prestation.date || prestation.created_at).toLocaleDateString('fr-FR')}
                              </td>
                              <td style={{padding: 12, fontSize: 13}}>
                                <StatusBadge status={prestation.status} />
                              </td>
                              <td style={{padding: 12, textAlign: 'center'}}>
                                <div style={{display: 'flex', gap: 6, justifyContent: 'center'}}>
                                  <button
                                    onClick={() => setSelectedPrestation(prestation)}
                                    title="Détails"
                                    style={{
                                      padding: '6px 10px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                  >
                                    👁️
                                  </button>
                                  <button
                                    onClick={() => cancelPrestation(prestation.id)}
                                    title="Annuler — repassera en À saisir"
                                    style={{
                                      padding: '6px 10px',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      border: '1px solid #fca5a5',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      transition: 'background 0.2s'
                                    }}
                                  >
                                    🔄 Annuler
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Pharmacien Forfaits Section */}
            {(pharmacienGroups.length > 0 || pharmacienLoading) && (
              <div style={{marginTop: 40}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                  <h2 style={{fontSize:20,fontWeight:700,color:'#7e22ce',margin:0}}>💊 Forfaits Pharmaciens</h2>
                  <span style={{padding:'3px 10px',background:'#faf5ff',border:'1px solid #d8b4fe',borderRadius:20,fontSize:12,color:'#7e22ce',fontWeight:600}}>400€ / demi-mois</span>
                </div>
                {pharmacienLoading ? (
                  <div style={{padding:20,color:'#6b7280',fontSize:14}}>⏳ Chargement des forfaits pharmaciens...</div>
                ) : (
                  <div style={{display:'grid',gap:16}}>
                    {pharmacienGroups.map(group => (
                      <div key={group.group_key} style={{background:'white',borderRadius:10,border:'2px solid #d8b4fe',padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:16,color:'#1f2937'}}>{group.user_name}</div>
                            <div style={{fontSize:13,color:'#6b7280',marginTop:2}}>{group.email}</div>
                            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                              <span style={{padding:'3px 10px',background:'#faf5ff',border:'1px solid #d8b4fe',borderRadius:6,fontSize:12,color:'#7e22ce',fontWeight:600}}>📅 Période: {group.period_label}</span>
                              <span style={{padding:'3px 10px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,fontSize:12,color:'#15803d',fontWeight:600}}>⏱ {(group.total_hours || 0).toFixed(2)}h travaillées</span>
                              <span style={{padding:'3px 10px',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:6,fontSize:12,color:'#92400e',fontWeight:700}}>💶 Forfait: {group.forfait_amount}€</span>
                              {group.analytic_name && (
                                <span style={{padding:'3px 10px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:6,fontSize:12,color:'#166534',fontWeight:600}}>📊 {group.analytic_name}{group.analytic_code ? ` (${group.analytic_code})` : ''}</span>
                              )}
                              {!group.analytic_name && (
                                <span style={{padding:'3px 10px',background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:6,fontSize:12,color:'#92400e'}}>⚠️ Aucune analytique assignée</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => generateForfaitInvoice(group)}
                            disabled={!!generatingForfait[group.group_key]}
                            style={{padding:'10px 20px',background:generatingForfait[group.group_key]?'#9ca3af':'#7e22ce',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:generatingForfait[group.group_key]?'not-allowed':'pointer',whiteSpace:'nowrap'}}
                          >
                            {generatingForfait[group.group_key] ? '⏳ Génération...' : '📄 Générer facture 400€'}
                          </button>
                        </div>
                        {/* Sessions list */}
                        <div style={{marginTop:14,borderTop:'1px solid #f3e8ff',paddingTop:12}}>
                          <div style={{fontSize:12,color:'#9ca3af',fontWeight:600,marginBottom:8}}>SESSIONS ({group.prestations.length})</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                            {group.prestations.map(p => (
                              <div key={p.id} style={{padding:'5px 10px',background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:6,fontSize:12,color:'#6b21a8'}}>
                                <strong>{p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('fr-FR') : '-'}</strong>
                                {p.hours_actual != null ? <span style={{marginLeft:6,color:'#7e22ce'}}>{p.hours_actual}h</span> : null}
                                {p.comments ? <span style={{marginLeft:6,color:'#9ca3af',fontStyle:'italic'}}>{p.comments}</span> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      {/* Prestation detail panel (admin-styled) */}
      {selectedPrestation && (
        <div className={adminStyles['validation-panel']}>
          <div className={adminStyles['panel-header']}>
            <h2>🔎 Détails de la prestation</h2>
            <button className={adminStyles['close-btn']} onClick={() => setSelectedPrestation(null)}>✕</button>
          </div>

          <div className={adminStyles['panel-content']}>
            <div className={adminStyles['user-full-info']}>
              <h3>👤 Collaborateur</h3>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Nom:</span>
                <span>{selectedPrestation.user_name || `${selectedPrestation.first_name || ''} ${selectedPrestation.last_name || ''}`.trim()}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Date:</span>
                <span>{new Date(selectedPrestation.date || selectedPrestation.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Activité:</span>
                <span>{selectedPrestation.analytic_name || selectedPrestation.activity_type || '-'}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>ID Ebrigade:</span>
                <span>{selectedPrestation.ebrigade_activity_code || '-'}</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Montant:</span>
                <span>{(parseFloat(selectedPrestation.remuneration || 0) || 0).toFixed(2)} €</span>
              </div>
              <div className={adminStyles['info-row']}>
                <span className={adminStyles.label}>Statut:</span>
                <span>{selectedPrestation.status || '-'}</span>
              </div>
            </div>

            <div className={adminStyles['document-preview']}>
              <h3>📝 Commentaires</h3>
              <div className={adminStyles['document-info']}>
                <p>{selectedPrestation.comments || 'Aucun commentaire'}</p>
              </div>
            </div>

            {/* PDF buttons only - no card */}
            <div style={{display:'flex',gap:8,marginTop:12}}>
              {selectedPrestation.pdf_url ? (
                <a href={selectedPrestation.pdf_url} target="_blank" rel="noreferrer" className={adminStyles['view-document-btn']}>👁️ Voir le PDF</a>
              ) : (
                <button disabled style={{padding:'8px 12px',background:'#9ca3af',color:'#fff',borderRadius:6,border:'none'}}>Aucun PDF</button>
              )}
              {selectedPrestation.pdf_url ? (
                <a href={selectedPrestation.pdf_url} download style={{padding:'8px 12px',background:'#6b7280',color:'#fff',borderRadius:6,textDecoration:'none',display:'inline-block',textAlign:'center'}}>Télécharger</a>
              ) : null}
              <button onClick={() => { setConfirmPaymentItem(selectedPrestation); setConfirmPaymentOpen(true); }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Encodé</button>
            </div>

            <div className={adminStyles['validation-actions']}>
              <button className={adminStyles['btn-approve']} onClick={() => setSelectedPrestation(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Facture Wizard Modal */}
      {correctionWizardOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1400}} onClick={resetCorrectionWizard}>
          <div style={{background:'#fff',borderRadius:14,width:560,maxWidth:'96%',padding:28,boxShadow:'0 12px 48px rgba(0,0,0,0.3)',maxHeight:'90vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{margin:0,color:'#92400e',fontSize:18}}>⚠️ Correction de facture</h3>
              <div style={{display:'flex',gap:6}}>
                {[1,2,3].map(s => (
                  <div key={s} style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,background:correctionStep===s?'#f59e0b':correctionStep>s?'#10b981':'#e5e7eb',color:correctionStep>=s?'#fff':'#9ca3af'}}>{s}</div>
                ))}
              </div>
            </div>

            {correctionLoadingData ? (
              <div style={{padding:40,textAlign:'center',color:'#6b7280'}}>⏳ Chargement des factures...</div>
            ) : (
              <>
                {/* STEP 1: Select prestataire */}
                {correctionStep === 1 && (() => {
                  const users = Array.from(
                    correctionAllPrestations.reduce((m, p) => {
                      if (!m.has(p.user_id)) m.set(p.user_id, { user_id: p.user_id, user_name: p.user_name || p.email || ('#'+p.user_id) })
                      return m
                    }, new Map())
                  ).map(([,v]) => v).sort((a,b) => a.user_name.localeCompare(b.user_name))
                  return (
                    <div>
                      <p style={{color:'#374151',marginBottom:16,fontSize:14}}>Sélectionnez le prestataire dont la facture doit être corrigée.</p>
                      {users.length === 0 ? (
                        <div style={{color:'#6b7280',fontSize:13,padding:12,background:'#f9fafb',borderRadius:8}}>Aucune prestation facturée/payée trouvée.</div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:300,overflowY:'auto'}}>
                          {users.map(u => (
                            <button key={u.user_id} onClick={() => { setCorrectionSelectedUserId(u.user_id); setCorrectionStep(2) }}
                              style={{padding:'12px 16px',border:'2px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',textAlign:'left',fontSize:14,fontWeight:600,color:'#1f2937',transition:'all 0.15s'}}
                              onMouseEnter={e => { e.currentTarget.style.borderColor='#f59e0b'; e.currentTarget.style.background='#fffbeb' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}
                            >
                              👤 {u.user_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* STEP 2: Select invoice */}
                {correctionStep === 2 && (() => {
                  const userPrestations = correctionAllPrestations.filter(p => p.user_id === correctionSelectedUserId)
                  const invoices = [...new Set(userPrestations.map(p => p.invoice_number).filter(Boolean))]
                    .sort((a,b) => { const [ay=0,an=0]=a.split('-').map(Number); const [by=0,bn=0]=b.split('-').map(Number); return ay!==by?by-ay:bn-an })
                  const userName = userPrestations[0]?.user_name || ''
                  return (
                    <div>
                      <button onClick={() => setCorrectionStep(1)} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:13,marginBottom:12,padding:0}}>← Retour</button>
                      <p style={{color:'#374151',marginBottom:16,fontSize:14}}>Factures de <strong>{userName}</strong> — sélectionnez celle à corriger.</p>
                      {invoices.length === 0 ? (
                        <div style={{color:'#6b7280',fontSize:13,padding:12,background:'#f9fafb',borderRadius:8}}>Aucune facture numérotée trouvée pour ce prestataire.</div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {invoices.map(inv => {
                            const invPrestations = userPrestations.filter(p => p.invoice_number === inv)
                            const invTotal = invPrestations.reduce((s,p) => s + (parseFloat(p.remuneration)||0), 0)
                            return (
                              <button key={inv} onClick={() => { setCorrectionSelectedInvoice(inv); setCorrectionStep(3) }}
                                style={{padding:'12px 16px',border:'2px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}
                                onMouseEnter={e => { e.currentTarget.style.borderColor='#f59e0b'; e.currentTarget.style.background='#fffbeb' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}
                              >
                                <div style={{fontWeight:700,fontSize:14,color:'#1f2937'}}>📄 Facture {inv}</div>
                                <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>{invPrestations.length} prestation(s) · {invTotal.toFixed(2)}€ total</div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* STEP 3: Select prestation + amount/reason */}
                {correctionStep === 3 && (() => {
                  const invPrestations = correctionAllPrestations.filter(p => p.user_id === correctionSelectedUserId && p.invoice_number === correctionSelectedInvoice)
                  return (
                    <div>
                      <button onClick={() => { setCorrectionStep(2); setCorrectionSelectedPrestation(null); setCorrectionAmount(''); setCorrectionReason('') }} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:13,marginBottom:12,padding:0}}>← Retour</button>
                      {!correctionSelectedPrestation ? (
                        <>
                          <p style={{color:'#374151',marginBottom:16,fontSize:14}}>Sélectionnez la prestation à mettre en négatif dans la prochaine extraction.</p>
                          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:260,overflowY:'auto'}}>
                            {invPrestations.map(p => (
                              <button key={p.id} onClick={() => { setCorrectionSelectedPrestation(p); setCorrectionAmount(String(Math.abs(parseFloat(p.remuneration||0)))); setCorrectionReason(`AVOIR - correction facture ${p.invoice_number||'#'+p.id}`) }}
                                style={{padding:'12px 16px',border:'2px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}
                                onMouseEnter={e => { e.currentTarget.style.borderColor='#f59e0b'; e.currentTarget.style.background='#fffbeb' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}
                              >
                                <div style={{fontWeight:600,fontSize:13,color:'#1f2937'}}>{p.activity_type || p.analytic_name || 'Prestation #'+p.id}</div>
                                <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>
                                  📅 {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '-'} &nbsp;·&nbsp;
                                  <strong style={{color:'#1f2937'}}>{(parseFloat(p.remuneration||0)).toFixed(2)}€</strong> &nbsp;·&nbsp;
                                  {p.status}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{background:'#fef3c7',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#78350f'}}>
                            Prestation sélectionnée : <strong>{correctionSelectedPrestation.activity_type || '#'+correctionSelectedPrestation.id}</strong><br/>
                            Montant original : <strong>{(parseFloat(correctionSelectedPrestation.remuneration||0)).toFixed(2)}€</strong>
                          </div>
                          <div style={{marginBottom:14}}>
                            <label style={{display:'block',fontWeight:600,marginBottom:4,fontSize:13}}>Montant de l'avoir (€) <span style={{color:'#dc2626'}}>*</span></label>
                            <input type="number" step="0.01" min="0.01" value={correctionAmount} onChange={e => setCorrectionAmount(e.target.value)}
                              style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:15,boxSizing:'border-box'}} />
                            <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>Sera inscrit comme <strong style={{color:'#dc2626'}}>{correctionAmount ? (-Math.abs(Number(correctionAmount))).toFixed(2) : '-X.XX'}€</strong> dans la prochaine facture</div>
                          </div>
                          <div style={{marginBottom:20}}>
                            <label style={{display:'block',fontWeight:600,marginBottom:4,fontSize:13}}>Raison <span style={{color:'#dc2626'}}>*</span></label>
                            <input type="text" value={correctionReason} onChange={e => setCorrectionReason(e.target.value)}
                              style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,boxSizing:'border-box'}} />
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                            <button onClick={() => { setCorrectionSelectedPrestation(null); setCorrectionAmount(''); setCorrectionReason('') }} style={{padding:'9px 16px',background:'#f3f4f6',border:'none',borderRadius:6,cursor:'pointer',fontWeight:500}}>Choisir une autre prestation</button>
                            <button onClick={submitCorrectionAvoir} disabled={correctionSubmitting} style={{padding:'9px 20px',background:correctionSubmitting?'#9ca3af':'#f59e0b',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700}}>
                              {correctionSubmitting ? 'Création...' : '✅ Confirmer l’avoir'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}
              </>
            )}

            <div style={{marginTop:20,textAlign:'right'}}>
              <button onClick={resetCorrectionWizard} style={{padding:'8px 14px',background:'#f3f4f6',border:'none',borderRadius:6,cursor:'pointer',color:'#374151',fontSize:13}}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Avoirs History Modal */}
      {avoirsModalOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1400}} onClick={() => setAvoirsModalOpen(false)}>
          <div style={{background:'#fff',borderRadius:12,width:'95%',maxWidth:900,maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <h2 style={{margin:0,fontSize:20,fontWeight:700,color:'#111827'}}>📋 Historique des avoirs</h2>
                <p style={{margin:'4px 0 0',fontSize:13,color:'#6b7280'}}>Traçabilité des corrections de facturation créées</p>
              </div>
              <button onClick={() => setAvoirsModalOpen(false)} style={{border:'none',background:'#f3f4f6',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            {/* Body */}
            <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
              {avoirsLoading ? (
                <div style={{textAlign:'center',padding:40,color:'#6b7280'}}>⏳ Chargement...</div>
              ) : avoirs.length === 0 ? (
                <div style={{textAlign:'center',padding:40,color:'#6b7280'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📭</div>
                  <div style={{fontSize:15}}>Aucun avoir créé pour l'instant.</div>
                </div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>#</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Date création</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Prestataire</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Analytique</th>
                      <th style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#374151'}}>Montant</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Raison</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Prestation originale</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>Statut avoir</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#374151'}}>N° facture avoir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avoirs.map((a, idx) => {
                      const amount = parseFloat(a.amount || 0)
                      const isEven = idx % 2 === 0
                      return (
                        <tr key={a.id} style={{borderBottom:'1px solid #f3f4f6',background:isEven ? '#fff' : '#fafafa'}}>
                          <td style={{padding:'10px 12px',color:'#9ca3af',fontWeight:600}}>#{a.id}</td>
                          <td style={{padding:'10px 12px',color:'#374151',whiteSpace:'nowrap'}}>
                            {a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'}
                          </td>
                          <td style={{padding:'10px 12px',color:'#111827',fontWeight:600}}>
                            {a.first_name || a.last_name
                              ? `${a.first_name || ''} ${a.last_name || ''}`.trim()
                              : a.email || '—'}
                            {a.email && <div style={{fontSize:11,color:'#9ca3af'}}>{a.email}</div>}
                          </td>
                          <td style={{padding:'10px 12px',color:'#374151'}}>{a.analytic_name || '—'}</td>
                          <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#dc2626',whiteSpace:'nowrap'}}>
                            {amount.toFixed(2)}€
                          </td>
                          <td style={{padding:'10px 12px',color:'#374151',maxWidth:220}}>
                            <span title={a.reason} style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {a.reason || '—'}
                            </span>
                          </td>
                          <td style={{padding:'10px 12px',color:'#374151',whiteSpace:'nowrap'}}>
                            {a.original_prestation_id ? (
                              <span style={{display:'flex',flexDirection:'column',gap:2}}>
                                <span style={{fontWeight:600}}>#{a.original_prestation_id}</span>
                                {a.orig_invoice_number && <span style={{fontSize:11,color:'#6b7280'}}>{a.orig_invoice_number}</span>}
                                {a.orig_date && <span style={{fontSize:11,color:'#9ca3af'}}>{new Date(a.orig_date).toLocaleDateString('fr-FR')}</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            {(() => {
                              const s = a.status || ''
                              let bg = '#f3f4f6', color = '#374151', label = s
                              if (s === 'Envoyé à la facturation') { bg = '#fef3c7'; color = '#92400e'; label = '📤 En attente' }
                              else if (s === 'Facturé') { bg = '#dcfce7'; color = '#166534'; label = '✅ Facturé' }
                              else if (s === 'Payé') { bg = '#dbeafe'; color = '#1e40af'; label = '💳 Payé' }
                              return <span style={{background:bg,color,padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{label}</span>
                            })()}
                          </td>
                          <td style={{padding:'10px 12px',color:'#374151',fontFamily:'monospace',fontSize:12}}>
                            {a.invoice_number || <span style={{color:'#9ca3af',fontFamily:'sans-serif'}}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {/* Footer */}
            <div style={{padding:'14px 24px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f9fafb'}}>
              <span style={{fontSize:13,color:'#6b7280'}}>{avoirs.length} avoir(s) créé(s) au total</span>
              <button onClick={() => setAvoirsModalOpen(false)} style={{padding:'8px 20px',background:'#6b7280',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm payment encoded modal */}
      {confirmPaymentOpen && confirmPaymentItem && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => { setConfirmPaymentOpen(false); setConfirmPaymentItem(null); }}>
          <div style={{background:'#fff',borderRadius:10,width:420,maxWidth:'90%',padding:20,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Confirmer l'encodage du paiement</h3>
            <p style={{color:'#374151'}}>Voulez-vous confirmer que le paiement pour <strong>{confirmPaymentItem.user_name || confirmPaymentItem.email}</strong> (prestation #{confirmPaymentItem.id}) est encodé ?</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button onClick={() => { setConfirmPaymentOpen(false); setConfirmPaymentItem(null); }} style={{padding:'8px 12px',background:'#f3f4f6',borderRadius:6,border:'none',cursor:'pointer'}}>Annuler</button>
              <button onClick={async () => {
                try {
                  // call API to update prestation status to 'Payé'
                  const res = await fetch(`/api/admin/prestations/${confirmPaymentItem.id}`, {
                    method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Payé' })
                  })
                  if (!res.ok) throw new Error('Erreur serveur')
                  // Refresh the list to remove encoded item (it's now filtered out)
                  await fetchPrestations()
                } catch (e) {
                  console.error('Encodage paiement failed', e)
                  alert('Erreur lors de l\'encodage du paiement')
                } finally {
                  setConfirmPaymentOpen(false)
                  setConfirmPaymentItem(null)
                  setSelectedPrestation(null)
                }
              }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {/* RIB Modal */}
      {ribModalOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200}} onClick={() => setRibModalOpen(false)}>
          <div style={{background:'#fff',borderRadius:8,width:'95%',maxWidth:1100,maxHeight:'90vh',overflow:'auto',padding:20}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h2 style={{margin:0}}>🧾 RIB validés — à encoder ({ribDocuments.length})</h2>
              <button onClick={() => setRibModalOpen(false)} style={{border:'none',background:'transparent',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>
            <div className={adminStyles['documents-grid']}>
              {ribDocuments.length === 0 ? (
                <div style={{padding:20,color:'#6b7280'}}>Aucun RIB validé à encoder</div>
              ) : ribDocuments.map(doc => (
                <div key={doc.id} className={adminStyles['document-card']} onClick={() => {}}>
                  <div className={adminStyles['doc-header']}>
                    <div className={adminStyles['doc-type-badge']}>📄 {doc.type || 'RIB'}</div>
                    <div className={adminStyles['doc-date']}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>

                  <div className={adminStyles['user-info']}>
                    <h3>{doc.user_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim()}</h3>
                    {doc.company_name && <p className={adminStyles.company}>🏢 {doc.company_name}</p>}
                    {doc.address && <p className={adminStyles.city}>📍 {doc.address}</p>}
                  </div>

                  <div className={adminStyles['doc-filename']}>
                    <strong>Fichier:</strong> {doc.name}
                  </div>

                  <div className={adminStyles['doc-size']}>
                    <strong>Taille:</strong> {(doc.file_size / 1024).toFixed(2)} KB
                  </div>

                  <div className={`${adminStyles['status-badge']} ${adminStyles.pending}`}>
                    {doc.validation_status === 'encoded' ? '📥 Encodé' : '✅ Validé par admin'}
                  </div>

                  <div style={{marginTop:12, display:'flex', gap:8}}>
                    <a href={`/api/documents/serve?id=${doc.id}`} target="_blank" rel="noreferrer" className={adminStyles['view-document-btn']}>Voir</a>
                    <a href={`/api/documents/serve?id=${doc.id}`} download={doc.name} style={{padding:'8px 12px',background:'#6b7280',color:'#fff',borderRadius:6,textDecoration:'none',textAlign:'center'}}>Télécharger</a>
                      <button onClick={() => { setConfirmDoc(doc); setConfirmEncodeOpen(true); }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Encodé</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Fiche Modal */}
      {ficheModalOpen && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200}} onClick={() => setFicheModalOpen(false)}>
          <div style={{background:'#fff',borderRadius:8,width:'95%',maxWidth:1100,maxHeight:'90vh',overflow:'auto',padding:20}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h2 style={{margin:0}}>Fiches de renseignement ({ficheUsers.length})</h2>
              <button onClick={() => setFicheModalOpen(false)} style={{border:'none',background:'transparent',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>
            <div className={adminStyles['documents-grid']}>
              {ficheUsers.length === 0 ? (
                <div style={{padding:20,color:'#6b7280'}}>Aucune fiche disponible</div>
              ) : ficheUsers.map(u => (
                <div key={u.id} className={adminStyles['document-card']} onClick={() => {}}>
                  <div className={adminStyles['doc-header']}>
                    <div className={adminStyles['doc-type-badge']}>👤 Fiche</div>
                    <div className={adminStyles['doc-date']}>{new Date().toLocaleDateString('fr-FR')}</div>
                  </div>

                  <div className={adminStyles['user-info']}>
                    <h3>{(u.first_name || '') + ' ' + (u.last_name || '')}</h3>
                    {u.company && <p className={adminStyles.company}>🏢 {u.company}</p>}
                    {u.address && <p className={adminStyles.city}>📍 {u.address}</p>}
                  </div>

                  <div style={{marginTop:12}}>
                    <button onClick={() => { setSelectedFiche(u); setFicheViewerOpen(true); }} className={adminStyles['view-document-btn']}>Voir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Fiche Viewer Modal - Detailed view without sensitive info */}
      {ficheViewerOpen && selectedFiche && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => setFicheViewerOpen(false)}>
          <div style={{background:'#fff',borderRadius:10,width:'95%',maxWidth:600,maxHeight:'90vh',overflow:'auto',padding:40,boxShadow:'0 10px 40px rgba(0,0,0,0.3)'}} onClick={(e)=>e.stopPropagation()}>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:30}}>
              <div>
                <h1 style={{margin:'0 0 8px 0',fontSize:28,fontWeight:700,color:'#111827'}}>
                  {(selectedFiche.first_name || '') + ' ' + (selectedFiche.last_name || '')}
                </h1>
                <p style={{margin:0,fontSize:14,color:'#6b7280'}}>Fiche renseignement</p>
              </div>
              <button onClick={() => setFicheViewerOpen(false)} style={{border:'none',background:'transparent',fontSize:24,cursor:'pointer',padding:0,color:'#6b7280'}}>✕</button>
            </div>

            {/* Informations personnelles */}
            <div style={{marginBottom:24}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations personnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {selectedFiche.address && (
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Adresse</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.address}</p>
                  </div>
                )}
                {selectedFiche.ninami && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>N'INAMI</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.ninami}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Informations professionnelles */}
            <div style={{paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 12px 0',fontSize:13,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Informations professionnelles</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {selectedFiche.role && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>R\u00f4le</label>
                    <span style={{background:'#e0e7ff',color:'#3730a3',padding:'4px 10px',borderRadius:4,fontSize:13,fontWeight:600}}>
                      {selectedFiche.role}
                    </span>
                  </div>
                )}
                {selectedFiche.fonction && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Fonction</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.fonction}</p>
                  </div>
                )}
                {selectedFiche.company && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Entreprise</label>
                    <p style={{margin:0,fontSize:15,color:'#111827'}}>{selectedFiche.company}</p>
                  </div>
                )}
                {selectedFiche.niss && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>NISS</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.niss}</p>
                  </div>
                )}
                {selectedFiche.bce && (
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>BCE</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.bce}</p>
                  </div>
                )}
                {selectedFiche.account && (
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>Compte bancaire</label>
                    <p style={{margin:0,fontSize:15,color:'#111827',fontFamily:'monospace'}}>{selectedFiche.account}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{marginTop:30,paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
              <button onClick={() => setFicheViewerOpen(false)} style={{width:'100%',padding:'10px 16px',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Encoded Modal */}
      {confirmEncodeOpen && confirmDoc && (
        <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1300}} onClick={() => { setConfirmEncodeOpen(false); setConfirmDoc(null); }}>
          <div style={{background:'#fff',borderRadius:10,width:400,maxWidth:'90%',padding:20,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Confirmer l'encodage</h3>
            <p style={{color:'#374151'}}>Voulez-vous confirmer que le RIB de <strong>{confirmDoc.user_name || confirmDoc.email}</strong> est encodé ?</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button onClick={() => { setConfirmEncodeOpen(false); setConfirmDoc(null); }} style={{padding:'8px 12px',background:'#f3f4f6',borderRadius:6,border:'none',cursor:'pointer'}}>Annuler</button>
              <button onClick={async () => { try { await markAsEncoded(confirmDoc.id); } finally { setConfirmEncodeOpen(false); setConfirmDoc(null); } }} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const statusConfig = {
    'Envoyé à la facturation': { bg: '#fef3c7', color: '#92400e', label: '📋 À facturer' },
    'Facturé': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'Payé': { bg: '#dbeafe', color: '#0c4a6e', label: '💳 Payé' },
    // Fallback for old codes
    'sent_to_billing': { bg: '#fef3c7', color: '#92400e', label: '📋 À facturer' },
    'invoiced': { bg: '#dcfce7', color: '#166534', label: '✅ Facturé' },
    'paid': { bg: '#dbeafe', color: '#0c4a6e', label: '💳 Payé' },
    'pending': { bg: '#f3f4f6', color: '#374151', label: '⏳ En attente' }
  }
  
  const config = statusConfig[status] || { bg: '#f3f4f6', color: '#374151', label: '⏳ Inconnu' }
  
  return (
    <span style={{
      background: config.bg,
      color: config.color,
      padding: '4px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      {config.label}
    </span>
  )
}
