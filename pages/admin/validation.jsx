import React from 'react'
import UserValidation from '../../components/UserValidation'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminValidationPage() {
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Validation des utilisateurs</h1>
          <div className="small-muted">Traiter les demandes d'inscription et compléter les profils</div>
        </div>
        <div className="admin-card card">
          <UserValidation />
        </div>
      </main>
    </div>
  )
}
