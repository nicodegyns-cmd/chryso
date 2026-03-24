import React, { useState } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'
import RoleSelectorModal from './RoleSelectorModal'
import AdminPrestationsSummary from './AdminPrestationsSummary'
import InvoiceStatistics from './InvoiceStatistics'

export default function AdminPanel() {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('prestations') // 'prestations' or 'statistics'
  const roles = ['admin', 'moderator', 'user']

  function handleSelectRole(r) {
    // placeholder: in real app call API to change effective role or filter view
    console.log('Selected role', r)
  }

  return (
    <div className="admin-root">
      <AdminHeader onOpenRoles={() => setModalOpen(true)} />

      <AdminSidebar onNavigate={(id) => console.log('nav to', id)} />

      <div className="admin-content">
        <header className="admin-header">
          <h1>Tableau de bord Admin</h1>
          <p className="muted">Gestion des demandes de prestations</p>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('prestations')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'prestations' ? '#0366d6' : 'transparent',
              color: activeTab === 'prestations' ? '#fff' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: activeTab === 'prestations' ? '3px solid #0366d6' : 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (activeTab !== 'prestations') e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (activeTab !== 'prestations') e.currentTarget.style.color = '#6b7280' }}
          >
            📋 Demandes de prestations
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'statistics' ? '#0366d6' : 'transparent',
              color: activeTab === 'statistics' ? '#fff' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: activeTab === 'statistics' ? '3px solid #0366d6' : 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (activeTab !== 'statistics') e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (activeTab !== 'statistics') e.currentTarget.style.color = '#6b7280' }}
          >
            📊 Statistiques des factures
          </button>
        </div>

        {/* Tab Content */}
        <section>
          {activeTab === 'prestations' && <AdminPrestationsSummary />}
          {activeTab === 'statistics' && <InvoiceStatistics />}
        </section>
      </div>

      <RoleSelectorModal open={modalOpen} onClose={() => setModalOpen(false)} roles={roles} onSelect={handleSelectRole} />
    </div>
  )
}
