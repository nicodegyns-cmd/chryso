import React from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import InvoiceStatistics from '../../components/InvoiceStatistics'

export default function AdminStatisticsPage() {
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Statistiques des factures</h1>
          <div className="small-muted">Analyse des montants et prestations par utilisateur, rôle et période</div>
        </div>
        <div className="admin-card card">
          <InvoiceStatistics />
        </div>
      </main>
    </div>
  )
}
