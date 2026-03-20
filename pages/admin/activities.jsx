import React from 'react'
import ActivitiesTable from '../../components/ActivitiesTable'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminActivitiesPage(){
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Activités</h1>
          <div className="small-muted">Créer et gérer les activités liées aux analytiques</div>
        </div>
        <div className="admin-card card">
          <ActivitiesTable />
        </div>
      </main>
    </div>
  )
}
