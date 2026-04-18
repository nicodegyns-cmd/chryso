import React from 'react'
import UserTable from '../../components/UserTable'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminUsersPage(){
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header" style={{paddingBottom: '12px'}}>
          <h1 style={{margin: '0 0 4px 0'}}>Utilisateurs</h1>
          <div className="small-muted">Gérer les comptes utilisateurs</div>
        </div>

        <div className="admin-card card">
          <UserTable />
        </div>
      </main>
    </div>
  )
}
