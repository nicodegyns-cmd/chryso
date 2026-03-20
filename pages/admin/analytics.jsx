import React from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import AnalyticsTable from '../../components/AnalyticsTable'

export default function AdminAnalyticsPage(){
  return (
    <div className="admin-root">
      <AdminHeader />
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <h1>Analytique</h1>
          <p className="muted">Créer et gérer les analytiques</p>
        </header>
        <section>
          <AnalyticsTable />
        </section>
      </div>
    </div>
  )
}
