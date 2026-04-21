import React, { useState } from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import InvoiceStatistics from '../../components/InvoiceStatistics'
import PrestationChartsAnalytic from '../../components/PrestationChartsAnalytic'

export default function AdminStatisticsPage() {
  const [activeTab, setActiveTab] = useState('invoices')

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid #e5e7eb',
    borderBottom: activeTab === tab ? '2px solid #fff' : '1px solid #e5e7eb',
    background: activeTab === tab ? '#fff' : '#f9fafb',
    color: activeTab === tab ? '#1f2937' : '#6b7280',
    fontWeight: activeTab === tab ? 700 : 500,
    fontSize: 14,
    cursor: 'pointer',
    marginBottom: '-1px',
    position: 'relative'
  })

  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Statistiques</h1>
          <div className="small-muted">Analyse des montants, prestations et graphiques par personnels et analytiques</div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 0 }}>
          <button style={tabStyle('invoices')} onClick={() => setActiveTab('invoices')}>
            📊 Statistiques factures
          </button>
          <button style={tabStyle('charts')} onClick={() => setActiveTab('charts')}>
            📈 Graphiques par analytique
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 8px 8px 8px', padding: 20 }}>
          {activeTab === 'invoices' && <InvoiceStatistics />}
          {activeTab === 'charts' && <PrestationChartsAnalytic />}
        </div>
      </main>
    </div>
  )
}
